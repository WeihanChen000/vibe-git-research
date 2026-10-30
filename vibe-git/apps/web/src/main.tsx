import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { IntroOverlay } from "./IntroOverlay";
import "./canvas/canvas.css";
import { SciencePALWorkspace } from "./sciencepal/SciencePALWorkspace";
import { CollaborationWorkspace } from "./sciencepal/CollaborationWorkspace";
import { TeamWorkspace } from "./sciencepal/TeamWorkspace";
import { WorkspaceEntry } from "./WorkspaceEntry";



ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode>{location.pathname.startsWith("/sciencepal/team") ? <TeamWorkspace /> : location.pathname.startsWith("/sciencepal/handoff") ? <SciencePALWorkspace /> : location.pathname.startsWith("/sciencepal") ? <CollaborationWorkspace /> : <WorkspaceEntry/>}</React.StrictMode>);
