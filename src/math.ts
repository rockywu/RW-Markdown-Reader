import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import "mathjax-full/js/input/tex/ams/AmsConfiguration.js";
import "mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js";
import "mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const engine = mathjax.document("", {
  InputJax: new TeX({
    packages: ["base", "ams", "newcommand", "noundefined"],
    maxBuffer: 20000,
  }),
  OutputJax: new SVG({ fontCache: "none" }),
});
export function renderMath(source: string, display: boolean) {
  engine.inputJax[0].reset();
  return adaptor.outerHTML(engine.convert(source, { display }));
}
