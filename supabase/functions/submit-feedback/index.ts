import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { token, star_rating, nps_score, nps_feedback, testimonial_text, private_feedback, respondent_name, respondent_email } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!star_rating || star_rating < 1 || star_rating > 5) {
      return new Response(JSON.stringify({ error: "Star rating (1-5) required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Validate token
    const { data: request, error: reqErr } = await sb
      .from("feedback_requests")
      .select("*")
      .eq("token", token)
      .single();

    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "Invalid or expired feedback link" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (request.completed) {
      return new Response(JSON.stringify({ error: "Feedback already submitted" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Look up customer
    const { data: customer } = await sb
      .from("customers")
      .select("id, is_key_account")
      .eq("name", request.customer_name)
      .single();

    // Insert feedback
    const { error: fbErr } = await sb.from("feedback").insert({
      invoice_id: request.invoice_id,
      invoice_num: request.invoice_num || null,
      customer_id: customer?.id || null,
      customer_name: request.customer_name,
      respondent_name: respondent_name || null,
      respondent_email: respondent_email || null,
      star_rating,
      nps_score: nps_score || null,
      nps_feedback: nps_feedback || null,
      testimonial_text: testimonial_text || null,
      private_feedback: private_feedback || null,
      feedback_type: "invoice",
    });

    if (fbErr) {
      console.error("Insert feedback error:", fbErr);
      return new Response(JSON.stringify({ error: "Failed to save feedback" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark request as completed
    await sb.from("feedback_requests").update({
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq("id", request.id);

    // If low rating, create notification for admin
    if (star_rating <= 2) {
      await sb.from("notifications").insert({
        type: "low_feedback",
        title: "Low Feedback Rating",
        message: `${star_rating} star rating from ${request.customer_name}${private_feedback ? ": " + private_feedback.slice(0, 100) : ""}`,
        for_role: "admin",
      });
    }

    // If high rating with testimonial, notify admin
    if (star_rating >= 4 && testimonial_text) {
      await sb.from("notifications").insert({
        type: "testimonial_received",
        title: "New Testimonial",
        message: `${star_rating} stars from ${request.customer_name}: "${testimonial_text.slice(0, 80)}..."`,
        for_role: "admin",
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Thank you for your feedback!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("submit-feedback error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
