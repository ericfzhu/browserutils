import{c as p,r as m,j as i,h as $}from"./theme-Bj67rSb2.js";import{c as _,P as f}from"./index-BYoWcpAf.js";/**
 * @license lucide-react v1.16.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]],D=p("arrow-left",I);/**
 * @license lucide-react v1.16.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=[["line",{x1:"10",x2:"14",y1:"2",y2:"2",key:"14vaq8"}],["line",{x1:"12",x2:"15",y1:"14",y2:"11",key:"17fdiu"}],["circle",{cx:"12",cy:"14",r:"8",key:"1e1u0o"}]],S=p("timer",E);var u="Progress",d=100,[j]=_(u),[w,A]=j(u),x=m.forwardRef((e,r)=>{const{__scopeProgress:n,value:t=null,max:a,getValueLabel:N=M,...b}=e;(a||a===0)&&!c(a)&&console.error(R(`${a}`,"Progress"));const o=c(a)?a:d;t!==null&&!v(t,o)&&console.error(L(`${t}`,"Progress"));const s=v(t,o)?t:null,h=l(s)?N(s,o):void 0;return i.jsx(w,{scope:n,value:s,max:o,children:i.jsx(f.div,{"aria-valuemax":o,"aria-valuemin":0,"aria-valuenow":l(s)?s:void 0,"aria-valuetext":h,role:"progressbar","data-state":y(s,o),"data-value":s??void 0,"data-max":o,...b,ref:r})})});x.displayName=u;var g="ProgressIndicator",P=m.forwardRef((e,r)=>{const{__scopeProgress:n,...t}=e,a=A(g,n);return i.jsx(f.div,{"data-state":y(a.value,a.max),"data-value":a.value??void 0,"data-max":a.max,...t,ref:r})});P.displayName=g;function M(e,r){return`${Math.round(e/r*100)}%`}function y(e,r){return e==null?"indeterminate":e===r?"complete":"loading"}function l(e){return typeof e=="number"}function c(e){return l(e)&&!isNaN(e)&&e>0}function v(e,r){return l(e)&&!isNaN(e)&&e<=r&&e>=0}function R(e,r){return`Invalid prop \`max\` of value \`${e}\` supplied to \`${r}\`. Only numbers greater than 0 are valid max values. Defaulting to \`${d}\`.`}function L(e,r){return`Invalid prop \`value\` of value \`${e}\` supplied to \`${r}\`. The \`value\` prop must be:
  - a positive number
  - less than the value passed to \`max\` (or ${d} if no \`max\` prop is set)
  - \`null\` or \`undefined\` if the progress is indeterminate.

Defaulting to \`null\`.`}var V=x,k=P;function O({className:e,value:r,...n}){return i.jsx(V,{"data-slot":"progress",className:$("relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",e),...n,children:i.jsx(k,{"data-slot":"progress-indicator",className:"size-full flex-1 bg-primary transition-all",style:{transform:`translateX(-${100-(r||0)}%)`}})})}export{D as A,O as P,S as T};
