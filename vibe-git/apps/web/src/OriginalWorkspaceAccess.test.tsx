import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";
import {OriginalWorkspaceAccess} from "./OriginalWorkspaceAccess";

describe("Original software workspace access", () => {
  it("offers the explicit software route even when a research project exists", () => {
    const html = renderToStaticMarkup(createElement(OriginalWorkspaceAccess));
    expect(html).toContain('href="/?view=software"');
    expect(html).toContain("打开原版软件协作");
  });
  it("does not send local proxy users to software APIs their proxy cannot serve", () => {
    const html = renderToStaticMarkup(createElement(OriginalWorkspaceAccess, {localPanel:true}));
    expect(html).not.toContain('href=');
    expect(html).toContain("仍需原房间的登录身份");
  });
});
