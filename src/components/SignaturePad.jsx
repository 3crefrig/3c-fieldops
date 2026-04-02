import React, { useCallback } from "react";
import { B } from "../shared";

export function SignaturePad({onSign}){
  const canvasRef=useCallback(canvas=>{
    if(!canvas)return;const ctx=canvas.getContext("2d");ctx.fillStyle=B.bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle=B.cyan;ctx.lineWidth=2;ctx.lineCap="round";ctx.lineJoin="round";
    let drawing=false,lastX=0,lastY=0;
    const getPos=(e)=>{const r=canvas.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return[t.clientX-r.left,t.clientY-r.top];};
    const start=(e)=>{e.preventDefault();drawing=true;[lastX,lastY]=getPos(e);};
    const move=(e)=>{if(!drawing)return;e.preventDefault();const[x,y]=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(x,y);ctx.stroke();lastX=x;lastY=y;canvas._hasSig=true;};
    const stop=()=>{drawing=false;};
    canvas.addEventListener("mousedown",start);canvas.addEventListener("mousemove",move);canvas.addEventListener("mouseup",stop);canvas.addEventListener("mouseleave",stop);
    canvas.addEventListener("touchstart",start,{passive:false});canvas.addEventListener("touchmove",move,{passive:false});canvas.addEventListener("touchend",stop);
    canvas._clear=()=>{ctx.fillStyle=B.bg;ctx.fillRect(0,0,canvas.width,canvas.height);canvas._hasSig=false;};
    canvas._getData=()=>canvas._hasSig?canvas.toDataURL("image/png"):null;
    if(onSign)onSign(canvas);
  },[]);
  return <canvas ref={canvasRef} width={320} height={140} style={{border:"1px solid "+B.border,borderRadius:6,touchAction:"none",cursor:"crosshair",width:"100%",maxWidth:320,height:140}}/>;
}
