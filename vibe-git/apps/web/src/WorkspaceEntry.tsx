import { useEffect, useState } from "react";
import { App } from "./App";
import { IntroOverlay } from "./IntroOverlay";
import { TeamWorkspace } from "./sciencepal/TeamWorkspace";

/** Existing rooms keep their original canvas; research rooms enter the same topology shell. */
export function WorkspaceEntry() {
  const software=new URLSearchParams(location.search).get("view")==="software";
  const [research,setResearch]=useState<boolean|null>(software?false:null);
  useEffect(()=>{if(software)return;const controller=new AbortController();
    fetch("/api/sciencepal-team/state",{credentials:"same-origin",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])})
      .then(async r=>r.ok?await r.json():null).then(s=>{if(!controller.signal.aborted)setResearch(!!s?.projects?.length);})
      .catch(()=>{if(!controller.signal.aborted)setResearch(false);});
    return()=>controller.abort();
  },[software]);
  return research===null?<div className="rt-shell"><main className="rt-empty">正在打开协作工作区…</main></div>:research?<TeamWorkspace/>:<><App/><IntroOverlay/></>;
}
