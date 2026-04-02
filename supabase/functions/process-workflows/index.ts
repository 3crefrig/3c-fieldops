import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Find waiting workflow runs whose resume_at has passed
    const now = new Date().toISOString();
    const { data: waiting, error: waitErr } = await sb
      .from("workflow_runs")
      .select("*")
      .eq("status", "waiting")
      .lte("resume_at", now);

    if (waitErr) {
      console.error("Query error:", waitErr);
      return new Response(JSON.stringify({ error: "Query failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!waiting || waiting.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let processed = 0;

    for (const run of waiting) {
      try {
        // Load the workflow definition
        const { data: workflow } = await sb
          .from("workflows")
          .select("*")
          .eq("id", run.workflow_id)
          .single();

        if (!workflow || !workflow.active) {
          await sb.from("workflow_runs").update({ status: "failed", completed_at: now, execution_log: [...(run.execution_log || []), { action: "skipped", reason: "workflow inactive or deleted", timestamp: now }] }).eq("id", run.id);
          continue;
        }

        const nodes = workflow.nodes || [];
        const edges = workflow.edges || [];
        const currentNodeId = run.current_node_id;

        // Find the next nodes after the current (wait) node
        const outEdges = edges.filter((e: any) => e.source === currentNodeId);
        let log = [...(run.execution_log || [])];
        let newStatus = "completed";
        let newCurrentNode = null;
        let newResumeAt = null;

        for (const edge of outEdges) {
          const nextNode = nodes.find((n: any) => n.id === edge.target);
          if (!nextNode) continue;

          if (nextNode.type === "condition") {
            // Evaluate condition against trigger data
            const passes = evaluateCondition(nextNode.config, run.trigger_data);
            log.push({ node_id: nextNode.id, action: "condition", result: passes, timestamp: now });
            if (!passes) continue;

            // Follow edges from this condition node
            const condEdges = edges.filter((e: any) => e.source === nextNode.id);
            for (const ce of condEdges) {
              const actionNode = nodes.find((n: any) => n.id === ce.target);
              if (actionNode) {
                const result = await executeAction(sb, actionNode, run.trigger_data);
                log.push({ node_id: actionNode.id, action: actionNode.config?.action_type || "action", result, timestamp: now });
              }
            }
          } else if (nextNode.type === "action") {
            const result = await executeAction(sb, nextNode, run.trigger_data);
            log.push({ node_id: nextNode.id, action: nextNode.config?.action_type || "action", result, timestamp: now });
          } else if (nextNode.type === "wait") {
            // Another wait node — pause again
            const delayHours = nextNode.config?.delay_hours || 24;
            newResumeAt = new Date(Date.now() + delayHours * 3600000).toISOString();
            newCurrentNode = nextNode.id;
            newStatus = "waiting";
            log.push({ node_id: nextNode.id, action: "wait", delay_hours: delayHours, timestamp: now });
            break;
          }
        }

        await sb.from("workflow_runs").update({
          status: newStatus,
          current_node_id: newCurrentNode,
          resume_at: newResumeAt,
          execution_log: log,
          completed_at: newStatus === "completed" ? now : null,
        }).eq("id", run.id);

        processed++;
      } catch (nodeErr) {
        console.error("Error processing run", run.id, nodeErr);
        await sb.from("workflow_runs").update({
          status: "failed",
          completed_at: now,
          execution_log: [...(run.execution_log || []), { action: "error", error: String(nodeErr), timestamp: now }],
        }).eq("id", run.id);
      }
    }

    return new Response(
      JSON.stringify({ processed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-workflows error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function evaluateCondition(config: any, triggerData: any): boolean {
  if (!config || !triggerData) return true;
  const { field, operator, value } = config;
  const actual = triggerData[field];
  if (actual === undefined) return false;

  switch (operator) {
    case "=": case "equals": return String(actual).toLowerCase() === String(value).toLowerCase();
    case "!=": case "not_equals": return String(actual).toLowerCase() !== String(value).toLowerCase();
    case ">": return parseFloat(actual) > parseFloat(value);
    case "<": return parseFloat(actual) < parseFloat(value);
    case ">=": return parseFloat(actual) >= parseFloat(value);
    case "<=": return parseFloat(actual) <= parseFloat(value);
    case "contains": return String(actual).toLowerCase().includes(String(value).toLowerCase());
    default: return true;
  }
}

async function executeAction(sb: any, node: any, triggerData: any) {
  const config = node.config || {};
  const actionType = config.action_type;

  switch (actionType) {
    case "send_email": {
      const to = config.to_email || triggerData?.customer_email;
      if (!to) return { success: false, reason: "no email" };
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      await fetch(supabaseUrl + "/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + anonKey },
        body: JSON.stringify({ to, subject: config.subject || "Notification from 3C Refrigeration", body: config.body || "" }),
      });
      return { success: true, sent_to: to };
    }
    case "create_notification": {
      await sb.from("notifications").insert({
        type: "workflow",
        title: config.title || "Workflow Alert",
        message: config.message || JSON.stringify(triggerData).slice(0, 200),
        for_role: config.for_role || null,
      });
      return { success: true };
    }
    case "change_wo_status": {
      const woId = triggerData?.id || triggerData?.wo_id;
      if (woId && config.new_status) {
        await sb.from("work_orders").update({ status: config.new_status }).eq("id", woId);
        return { success: true, new_status: config.new_status };
      }
      return { success: false, reason: "missing wo_id or status" };
    }
    case "log_activity": {
      const woId = triggerData?.id || triggerData?.wo_id;
      if (woId) {
        await sb.from("wo_activity").insert({
          wo_id: woId,
          action: "workflow",
          details: config.message || "Automated workflow action",
          actor: "Workflow Engine",
        });
        return { success: true };
      }
      return { success: false };
    }
    default:
      return { success: false, reason: "unknown action: " + actionType };
  }
}
