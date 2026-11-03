import { legacyHelper } from "./legacy.js";

// import fakeFromComment from "./fake_comment";
/* 
import fakeFromMultiline from "./fake_multiline";
export { fake } from "./fake_multiline_export";
*/

const fakeStr = "import fakeFromStr from './fake_string'";
const fakeTmpl = `import fakeFromTmpl from './fake_template'`;

// Dynamic imports
const realDyn = import("./legacy.js");
const fakeDynExpr = import("./prefix_" + num);
const fakeDynVar = import(someVar);

// CommonJS requires
const realReq = require("./legacy.js");
const fakeReqVar = require(someVar);

