(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "dcef7ccf-ec84-4bf7-9532-b50270b6b12b", e._sentryDebugIdIdentifier = "sentry-dbid-dcef7ccf-ec84-4bf7-9532-b50270b6b12b");
	} catch {}
})();
import { CHART_CARD as e, CategoryTick as t, ChartEmpty as n, ChartHead as r, ChartTip as i, Dot as a, EvilBarChart as o, FillObjectPaint as s, Layer as c, TIP_SURFACE as l, TIP_SWATCH as u, Text as d, TipRow as f, ZIndexLayer as p, adaptEventsOfChild as m, addAngleAxis as h, categoryAxisWidth as g, combineAxisTicks as _, combineCategoricalDomain as v, combineConfiguredScale as y, combineGraphicalItemTicks as b, createSelector as x, defaultPolarAngleAxisProps as S, degreeToRadian as C, getAxisTypeBasedOnLayout as w, getClassNameFromUnknown as T, noop as E, pickAxisType as D, polarToCartesian as O, rechartsScaleFactory as ee, removeAngleAxis as te, resolveDefaultProps as ne, roundTemplateLiteral as re, selectAngleAxis as k, selectAngleAxisRangeWithReversed as ie, selectChartLayout as A, selectDuplicateDomain as j, selectPolarAppliedValues as ae, selectPolarAxisCheckedDomain as oe, selectPolarNiceTicks as se, selectPolarViewBox as ce, selectRadiusAxis as le, selectRadiusAxisRangeWithReversed as ue, selectRealScaleType as de, selectRenderableAxisSettings as fe, svgPropertiesAndEvents as M, svgPropertiesNoEvents as N, svgPropertiesNoEventsFromUnknown as pe, tone as me, useAppDispatch as he, useAppSelector as P, useIsPanorama as ge, usePolarChartLayout as _e, useRechartsTheme as ve } from "./peach-app.chart-tip-BdEMpPYU.js";
import { __toESM as ye, clsx as F, f1 as be, interfaceLanguage as xe, require_jsx_runtime as Se, require_react as Ce, t as I } from "./peach-app.js";
// node_modules/recharts/es6/shape/Polygon.js
var L = /* @__PURE__ */ ye(Ce()), we = [
	"points",
	"className",
	"baseLinePoints",
	"connectNulls"
], Te;
function R() {
	return R = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, R.apply(null, arguments);
}
function Ee(e, t) {
	if (e == null) return {};
	var n, r, i = De(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function De(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function Oe(e, t) {
	return t ||= e.slice(0), Object.freeze(Object.defineProperties(e, { raw: { value: Object.freeze(t) } }));
}
var z = (e) => e != null && e.x === +e.x && e.y === +e.y, ke = function() {
	var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [], t = [[]];
	e.forEach((e) => {
		var n = t[t.length - 1];
		z(e) ? n && n.push(e) : n && n.length > 0 && t.push([]);
	});
	var n = e[0], r = t[t.length - 1];
	z(n) && r && r.push(n);
	var i = t[t.length - 1];
	return i && i.length <= 0 && (t = t.slice(0, -1)), t;
}, B = (e, t) => {
	var n = ke(e);
	t && (n = [n.reduce((e, t) => [...e, ...t], [])]);
	var r = n.map((e) => e.reduce((e, t, n) => re(Te ||= Oe([
		"",
		"",
		"",
		",",
		""
	]), e, n === 0 ? "M" : "L", t.x, t.y), "")).join("");
	return n.length === 1 ? `${r}Z` : r;
}, Ae = (e, t, n) => {
	var r = B(e, n);
	return `${r.slice(-1) === "Z" ? r.slice(0, -1) : r}L${B(Array.from(t).reverse(), n).slice(1)}`;
}, V = (e) => {
	var t = e.points, n = e.className, r = e.baseLinePoints, i = e.connectNulls, a = Ee(e, we);
	if (!t || !t.length) return null;
	var o = F("recharts-polygon", n);
	if (r && r.length) {
		var s = a.stroke && a.stroke !== "none", c = Ae(t, r, i);
		return /*#__PURE__*/ L.createElement("g", { className: o }, /*#__PURE__*/ L.createElement("path", R({}, M(a), {
			fill: c.slice(-1) === "Z" ? a.fill : "none",
			stroke: "none",
			d: c
		})), s ? /*#__PURE__*/ L.createElement("path", R({}, M(a), {
			fill: "none",
			d: B(t, i)
		})) : null, s ? /*#__PURE__*/ L.createElement("path", R({}, M(a), {
			fill: "none",
			d: B(r, i)
		})) : null);
	}
	var l = B(t, i);
	return /*#__PURE__*/ L.createElement("path", R({}, M(a), {
		fill: l.slice(-1) === "Z" ? a.fill : "none",
		className: o,
		d: l
	}));
}, H = (e) => {
	var t = e.fill;
	return typeof t == "object" && t ? /*#__PURE__*/ L.createElement(s, { fill: t }, (t) => /*#__PURE__*/ L.createElement(V, R({}, e, { fill: t }))) : /*#__PURE__*/ L.createElement(V, R({}, e, { fill: t }));
}, U = (e, t, n) => {
	switch (t) {
		case "angleAxis": return k(e, n);
		case "radiusAxis": return le(e, n);
		default: throw Error(`Unexpected axis type: ${t}`);
	}
}, W = (e, t, n) => {
	switch (t) {
		case "angleAxis": return ie(e, n);
		case "radiusAxis": return ue(e, n);
		default: throw Error(`Unexpected axis type: ${t}`);
	}
}, je = x([
	U,
	de,
	oe,
	W
], y), G = x([je], ee), Me = x([
	A,
	ae,
	fe,
	D
], v), Ne = x([
	A,
	U,
	de,
	G,
	se,
	W,
	j,
	Me,
	D
], _), Pe = x([Ne], (e) => {
	if (e) {
		var t = /* @__PURE__ */ new Map();
		return e.forEach((e) => {
			var n = (e.coordinate + 360) % 360;
			t.has(n) || t.set(n, e);
		}), Array.from(t.values());
	}
}), Fe = x([
	A,
	U,
	G,
	W,
	j,
	Me,
	D
], b), Ie = ["children", "type"], Le = ["ref"];
function K() {
	return K = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, K.apply(null, arguments);
}
function Re(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function q(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Re(Object(n), !0).forEach(function(t) {
			ze(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Re(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function ze(e, t, n) {
	return (t = Be(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Be(e) {
	var t = Ve(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Ve(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function He(e, t) {
	if (e == null) return {};
	var n, r, i = Ue(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Ue(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var We = 1e-5, Ge = Math.cos(C(45)), Ke = "angleAxis";
function qe(e) {
	var t = he(), n = _e(), r = (0, L.useMemo)(() => {
		e.children;
		var t = e.type, r = He(e, Ie), i = w(n, "angleAxis", t);
		if (i != null) return q(q({}, r), {}, { type: i });
	}, [e, n]), i = r === P((e) => k(e, r?.id));
	return (0, L.useEffect)(() => r == null ? E : (t(h(r)), () => {
		t(te(r));
	}), [t, r]), i ? e.children : null;
}
var Je = (e, t) => {
	var n = t.cx, r = t.cy, i = t.radius, a = t.orientation, o = t.tickSize || 8, s = O(n, r, i, e.coordinate), c = O(n, r, i + (a === "inner" ? -1 : 1) * o, e.coordinate);
	return {
		x1: s.x,
		y1: s.y,
		x2: c.x,
		y2: c.y
	};
}, Ye = (e, t) => {
	var n = Math.cos(C(-e.coordinate));
	return n > We ? t === "outer" ? "start" : "end" : n < -We ? t === "outer" ? "end" : "start" : "middle";
}, Xe = (e) => {
	var t = Math.cos(C(-e.coordinate)), n = Math.sin(C(-e.coordinate));
	return Math.abs(t) <= Ge ? n > 0 ? "start" : "end" : "middle";
}, Ze = (e) => {
	var t = e.cx, n = e.cy, r = e.radius, i = e.axisLineType, o = e.axisLine, s = e.ticks;
	if (!o) return null;
	var c = q(q({}, N(e)), {}, { fill: "none" }, N(o));
	if (i === "circle") return /*#__PURE__*/ L.createElement(a, K({ className: "recharts-polar-angle-axis-line" }, c, {
		cx: t,
		cy: n,
		r
	}));
	var l = s.map((e) => O(t, n, r, e.coordinate));
	return /*#__PURE__*/ L.createElement(H, K({ className: "recharts-polar-angle-axis-line" }, c, { points: l }));
}, Qe = (e) => {
	var t = e.tick, n = e.tickProps, r = e.value;
	return t ? /*#__PURE__*/ L.isValidElement(t) ? /*#__PURE__*/ L.cloneElement(t, n) : typeof t == "function" ? t(n) : /*#__PURE__*/ L.createElement(d, K({}, n, { className: "recharts-polar-angle-axis-tick-value" }), r) : null;
}, $e = (e) => {
	var t = e.tick, n = e.tickLine, r = e.tickFormatter, i = e.stroke, a = e.ticks, o = N(e);
	o.ref;
	var s = He(o, Le), l = pe(t), u = q(q({}, s), {}, { fill: "none" }, N(n)), d = a.map((a, o) => {
		var d = Je(a, e), f = Ye(a, e.orientation), p = Xe(a), h = q(q(q({}, s), {}, {
			textAnchor: f,
			verticalAnchor: p,
			stroke: "none",
			fill: i
		}, l), {}, {
			index: o,
			payload: a,
			x: d.x2,
			y: d.y2
		});
		return /*#__PURE__*/ L.createElement(c, K({
			className: F("recharts-polar-angle-axis-tick", T(t)),
			key: `tick-${a.coordinate}`
		}, m(e, a, o)), n && /*#__PURE__*/ L.createElement("line", K({ className: "recharts-polar-angle-axis-tick-line" }, u, d)), /*#__PURE__*/ L.createElement(Qe, {
			tick: t,
			tickProps: h,
			value: r ? r(a.value, o) : a.value
		}));
	});
	return /*#__PURE__*/ L.createElement(c, { className: "recharts-polar-angle-axis-ticks" }, d);
}, et = (e) => {
	var t = e.angleAxisId, n = P(ce), r = P((e) => G(e, "angleAxis", t)), i = ge(), a = P((e) => Pe(e, "angleAxis", t, i)), o = ve();
	if (n == null || !a || !a.length || r == null) return null;
	var s = q(q(q({}, e), {}, { scale: r }, n), {}, {
		radius: n.outerRadius,
		ticks: a
	});
	return /*#__PURE__*/ L.createElement(p, { zIndex: s.zIndex }, /*#__PURE__*/ L.createElement(c, { className: F("recharts-polar-angle-axis", Ke, s.className) }, /*#__PURE__*/ L.createElement(Ze, K({}, o?.axis, s)), /*#__PURE__*/ L.createElement($e, K({}, o?.axis, s))));
};
function tt(e) {
	var t = ne(e, S);
	return /*#__PURE__*/ L.createElement(qe, {
		id: t.angleAxisId,
		scale: t.scale,
		type: t.type,
		dataKey: t.dataKey,
		unit: void 0,
		name: t.name,
		allowDuplicatedCategory: !1,
		allowDataOverflow: !1,
		reversed: t.reversed,
		includeHidden: !1,
		allowDecimals: t.allowDecimals,
		tickCount: t.tickCount,
		niceTicks: t.niceTicks ?? "auto",
		ticks: t.ticks,
		tick: t.tick,
		domain: t.domain
	}, /*#__PURE__*/ L.createElement(et, t));
}
tt.displayName = "PolarAngleAxis";
// src/react/charts/bar-card.tsx
var J = Se(), Y = [0, (e) => e * 1.2], nt = new Intl.NumberFormat(xe, {
	notation: "compact",
	maximumSignificantDigits: 3
});
function rt(e) {
	return Math.abs(e) >= 1e5 ? nt.format(e) : e.toLocaleString();
}
var it = (e) => ({
	position: e,
	className: "fill-text-secondary",
	formatter: (e) => rt(Number(e))
});
function at({ title: a, unit: s, series: c, rows: l, color: u, empty: d, layout: f = "vertical" }) {
	let p = l.filter((e) => Number.isFinite(e.value) && e.value >= 0).map((e) => ({
		name: e.name,
		value: e.value
	})), m = p.reduce((e, t) => e + t.value, 0);
	if (!m) return /* @__PURE__ */ (0, J.jsx)(n, {
		title: a,
		children: d
	});
	let h = f === "horizontal";
	return /* @__PURE__ */ (0, J.jsxs)("section", {
		className: e,
		"aria-label": a,
		children: [/* @__PURE__ */ (0, J.jsx)(r, {
			title: a,
			figure: m.toLocaleString(),
			note: s(m)
		}), /* @__PURE__ */ (0, J.jsxs)(o, {
			data: p,
			config: { value: {
				label: c,
				colors: me(u)
			} },
			layout: f,
			barRadius: 4,
			chartProps: h ? { margin: {
				top: 5,
				right: 56,
				bottom: 5,
				left: 5
			} } : void 0,
			className: h ? "aspect-auto h-64 flex-none text-text-secondary" : "aspect-auto h-56 flex-none text-text-secondary",
			children: [
				/* @__PURE__ */ (0, J.jsx)(o.Grid, {}),
				h ? /* @__PURE__ */ (0, J.jsx)(o.YAxis, {
					dataKey: "name",
					interval: 0,
					tick: /* @__PURE__ */ (0, J.jsx)(t, { along: "y" }),
					width: g(p.map((e) => e.name))
				}) : /* @__PURE__ */ (0, J.jsx)(o.XAxis, {
					dataKey: "name",
					interval: 0,
					tick: /* @__PURE__ */ (0, J.jsx)(t, { along: "x" })
				}),
				h ? /* @__PURE__ */ (0, J.jsx)(o.XAxis, {
					hide: !0,
					domain: Y
				}) : /* @__PURE__ */ (0, J.jsx)(o.YAxis, {
					hide: !0,
					domain: Y
				}),
				/* @__PURE__ */ (0, J.jsx)(o.Bar, {
					dataKey: "value",
					enableHoverHighlight: !0,
					barProps: {
						dataKey: "value",
						label: it(h ? "right" : "top")
					}
				}),
				/* @__PURE__ */ (0, J.jsx)(i, {})
			]
		})]
	});
}
// src/react/charts/heat.ts
var ot = [
	I("manage:heatChart.monday"),
	I("manage:heatChart.tuesday"),
	I("manage:heatChart.wednesday"),
	I("manage:heatChart.thursday"),
	I("manage:heatChart.friday"),
	I("manage:heatChart.saturday"),
	I("manage:heatChart.sunday")
], X = (e, t) => e ? Math.max(.12, e / t) : 0;
function st(e) {
	let t = Array.from({ length: 7 }, () => Array(24).fill(0));
	for (let n of e?.hours || []) {
		let { weekday: e, hour: r, count: i } = n;
		!Number.isInteger(e) || e < 0 || e > 6 || !Number.isInteger(r) || r < 0 || r > 23 || !Number.isFinite(i) || i < 0 || (t[e][r] = (t[e][r] || 0) + i);
	}
	let n = t.flat(), r = Math.max(1, ...n);
	return {
		cells: t.flatMap((e, t) => e.map((e, n) => ({
			key: `${t}-${n}`,
			label: `${ot[t]} ${n}:00`,
			count: e,
			share: X(e, r)
		}))),
		total: n.reduce((e, t) => e + t, 0)
	};
}
function ct(e) {
	let t = (e?.days || []).filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Number.isFinite(e.count) && e.count >= 0).slice().sort((e, t) => e.date.localeCompare(t.date)), n = {
		cells: [],
		total: 0,
		start: "",
		end: ""
	};
	if (!t.length) return n;
	let r = /* @__PURE__ */ new Date(`${t.at(-1).date}T00:00:00Z`), i = new Date(r);
	i.setUTCDate(i.getUTCDate() - 90);
	let a = new Map(t.map((e) => [e.date, e.count])), o = Math.max(1, ...t.map((e) => e.count)), s = Array.from({ length: 91 }, (e, t) => {
		let n = new Date(i);
		n.setUTCDate(i.getUTCDate() + t);
		let r = n.toISOString().slice(0, 10), s = a.get(r) || 0;
		return {
			key: r,
			label: r,
			count: s,
			share: X(s, o)
		};
	});
	return {
		cells: s,
		total: s.reduce((e, t) => e + t.count, 0),
		start: i.toISOString().slice(0, 10),
		end: t.at(-1).date
	};
}
// src/react/charts/heat-card.tsx
var Z = 14, Q = 17, lt = {
	4: {
		fill: "fill-chart-4",
		dot: "bg-chart-4"
	},
	5: {
		fill: "fill-chart-5",
		dot: "bg-chart-5"
	}
}, ut = {
	start: "translate-x-0",
	center: "-translate-x-1/2",
	end: "-translate-x-full"
};
function dt({ cell: e, series: t, tone: n, left: r, top: i, anchor: a }) {
	return /* @__PURE__ */ (0, J.jsxs)("div", {
		"aria-hidden": !0,
		style: {
			left: `${r}%`,
			top: `${i}%`
		},
		className: `pointer-events-none absolute z-10 -mt-2 -translate-y-full ${l} ${ut[a]}`,
		children: [/* @__PURE__ */ (0, J.jsx)("div", {
			className: "font-medium text-foreground",
			children: e.label
		}), /* @__PURE__ */ (0, J.jsx)(f, {
			name: t,
			value: e.count,
			swatch: /* @__PURE__ */ (0, J.jsx)("i", { className: `${u} ${lt[n].dot}` })
		})]
	});
}
function $({ title: t, words: n, cells: i, total: a, columns: o, rows: s, axis: c, footer: l, tone: u }) {
	let [d, f] = (0, L.useState)(-1), [p, m] = (0, L.useState)(0), h = (0, L.useRef)(null), g = p < i.length ? p : 0, _ = c ? 30 : 0, v = c ? 18 : 0, y = _ + o * Q, b = v + s * Q, x = (e) => ({
		x: _ + e % o * Q,
		y: v + Math.floor(e / o) * Q
	}), S = i[d], C = S ? x(d) : null, w = C ? (C.x + Z / 2) / y : 0, T = w < .1 ? "start" : w > .9 ? "end" : "center", E = C ? {
		start: C.x,
		center: C.x + Z / 2,
		end: C.x + Z
	}[T] : 0, D = (e, t) => {
		let n = t - t % o, r = {
			ArrowLeft: t - 1,
			ArrowRight: t + 1,
			ArrowUp: t - o,
			ArrowDown: t + o,
			Home: n,
			End: Math.min(n + o, i.length) - 1
		}[e.key];
		r !== void 0 && (e.preventDefault(), r < 0 || r >= i.length || (m(r), h.current?.querySelector(`rect[data-cell="${r}"]`)?.focus()));
	};
	return /* @__PURE__ */ (0, J.jsxs)("section", {
		className: e,
		children: [
			/* @__PURE__ */ (0, J.jsx)(r, {
				title: t,
				figure: (S ? S.count : a).toLocaleString(),
				note: S ? S.label : n.unit(a)
			}),
			/* @__PURE__ */ (0, J.jsxs)("div", {
				className: "relative",
				children: [/* @__PURE__ */ (0, J.jsx)("div", {
					className: "min-w-0 overflow-x-auto",
					children: /* @__PURE__ */ (0, J.jsxs)("svg", {
						ref: h,
						role: "img",
						"aria-label": t,
						onPointerLeave: () => f(-1),
						viewBox: `0 0 ${y} ${b}`,
						className: c ? "block h-auto min-w-80 w-full" : "block h-auto w-full",
						children: [c, i.map((e, t) => {
							let { x: r, y: i } = x(t);
							return /* @__PURE__ */ (0, J.jsx)("rect", {
								"data-cell": t,
								tabIndex: t === g ? 0 : -1,
								role: "img",
								"aria-label": `${e.label}${I("shell:format.clauseSeparator")}${n.cell(e.count)}`,
								x: r,
								y: i,
								width: Z,
								height: Z,
								rx: 3,
								fillOpacity: e.share || 1,
								opacity: d >= 0 && d !== t ? .4 : 1,
								className: e.share ? `outline-none transition-opacity duration-200 focus-visible:stroke-border-focus-ring ${lt[u].fill}` : "fill-chart-track outline-none transition-opacity duration-200 focus-visible:stroke-border-focus-ring",
								onPointerEnter: () => f(t),
								onFocus: () => {
									f(t), m(t);
								},
								onBlur: () => f(-1),
								onKeyDown: (e) => D(e, t)
							}, e.key);
						})]
					})
				}), S && C ? /* @__PURE__ */ (0, J.jsx)(dt, {
					cell: S,
					series: n.series,
					tone: u,
					anchor: T,
					left: E / y * 100,
					top: C.y / b * 100
				}) : null]
			}),
			/* @__PURE__ */ (0, J.jsx)("footer", {
				className: "flex flex-wrap justify-between gap-3 text-caption-1-regular text-text-secondary",
				children: l
			})
		]
	});
}
var ft = /* @__PURE__ */ (0, J.jsxs)(J.Fragment, { children: [ot.map((e, t) => /* @__PURE__ */ (0, J.jsx)("text", {
	x: 0,
	y: 18 + t * Q + 7,
	dominantBaseline: "middle",
	className: "fill-text-secondary text-caption-1-regular",
	children: e
}, e)), Array.from({ length: 24 }, (e, t) => t % 2 ? null : /* @__PURE__ */ (0, J.jsx)("text", {
	x: 30 + t * Q,
	y: 8,
	dominantBaseline: "middle",
	className: "fill-text-secondary text-caption-1-regular",
	children: t
}, t))] });
function pt({ activity: e, title: t, dailyTitle: r, words: i, tone: a, empty: o }) {
	let s = st(e), c = ct(e);
	return c.cells.length ? /* @__PURE__ */ (0, J.jsxs)("div", {
		className: "inline-grid w-full items-start gap-5 lg:grid-cols-2",
		children: [/* @__PURE__ */ (0, J.jsx)($, {
			title: t,
			words: i,
			tone: a,
			cells: s.cells,
			total: s.total,
			columns: 24,
			rows: 7,
			axis: ft,
			footer: /* @__PURE__ */ (0, J.jsxs)(J.Fragment, { children: [/* @__PURE__ */ (0, J.jsx)("span", { children: I("manage:charts.dayByHour") }), /* @__PURE__ */ (0, J.jsx)("span", { children: e?.timezone || "UTC+08:00" })] })
		}), /* @__PURE__ */ (0, J.jsx)($, {
			title: r,
			words: i,
			tone: a,
			cells: c.cells,
			total: c.total,
			columns: 13,
			rows: 7,
			footer: /* @__PURE__ */ (0, J.jsxs)(J.Fragment, { children: [/* @__PURE__ */ (0, J.jsx)("span", { children: c.start }), /* @__PURE__ */ (0, J.jsx)("span", { children: c.end })] })
		})]
	}) : /* @__PURE__ */ (0, J.jsx)(n, {
		title: t,
		children: o
	});
}
// src/react/components/expandable-ranking.tsx
function mt({ children: e, className: t = "", previewCount: n = 10 }) {
	let r = (0, L.useId)(), i = (0, L.useRef)(null), [a, o] = (0, L.useState)(!1), [s, c] = (0, L.useState)(!1), l = L.Children.toArray(e), u = l.length > n;
	(0, L.useLayoutEffect)(() => {
		let e = i.current;
		if (!e || !u) return;
		let t = () => {
			let t = e.children[Math.min(n, e.children.length) - 1];
			t && e.offsetWidth && (e.style.setProperty("--ranking-collapsed-height", `${t.offsetTop - e.offsetTop + t.offsetHeight}px`), e.style.setProperty("--ranking-expanded-height", `${e.scrollHeight}px`));
		};
		t();
		let r = new ResizeObserver(t);
		return r.observe(e), () => r.disconnect();
	}, [
		u,
		n,
		l.length
	]);
	let d = l.map((e, t) => !(0, L.isValidElement)(e) || t < n ? e : (0, L.cloneElement)(e, { inert: !a || void 0 }));
	return /* @__PURE__ */ (0, J.jsxs)("div", {
		"data-expandable-ranking": !0,
		"data-expandable": u || void 0,
		"data-expanded": a || void 0,
		"data-animating": s || void 0,
		children: [/* @__PURE__ */ (0, J.jsx)("ol", {
			id: r,
			ref: i,
			"data-expandable-ranking-list": !0,
			className: t,
			onTransitionEnd: (e) => {
				e.target === i.current && e.propertyName === "max-height" && c(!1);
			},
			children: d
		}), u ? /* @__PURE__ */ (0, J.jsx)("button", {
			type: "button",
			"data-ranking-toggle": !0,
			"aria-controls": r,
			"aria-expanded": a,
			"aria-label": I(a ? "shell:expandableRanking.collapse" : "shell:expandableRanking.expand"),
			onClick: () => {
				c(!0), o((e) => !e);
			},
			children: /* @__PURE__ */ (0, J.jsx)(be, { "aria-hidden": !0 })
		}) : null]
	});
}
export { pt as ActivityHeat, Y as BAR_DOMAIN, at as BarCard, mt as ExpandableRanking, tt as PolarAngleAxis, H as Polygon, it as barLabel, Pe as selectPolarAngleAxisTicks, G as selectPolarAxisScale, Ne as selectPolarAxisTicks, Fe as selectPolarGraphicalItemAxisTicks };

//# debugId=dcef7ccf-ec84-4bf7-9532-b50270b6b12b