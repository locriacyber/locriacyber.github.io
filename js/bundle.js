
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.4' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/Game.svelte generated by Svelte v3.29.4 */

    const file = "src/Game.svelte";

    function create_fragment(ctx) {
    	let svg;
    	let rect;
    	let circle;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			rect = svg_element("rect");
    			circle = svg_element("circle");
    			attr_dev(rect, "x", "0");
    			attr_dev(rect, "y", "0");
    			attr_dev(rect, "width", "100");
    			attr_dev(rect, "height", "100");
    			add_location(rect, file, 47, 4, 1087);
    			attr_dev(circle, "cx", /*ballx*/ ctx[0]);
    			attr_dev(circle, "cy", /*bally*/ ctx[1]);
    			attr_dev(circle, "r", ballr);
    			attr_dev(circle, "class", "svelte-20vn2q");
    			add_location(circle, file, 48, 4, 1128);
    			attr_dev(svg, "width", "400");
    			attr_dev(svg, "height", "400");
    			attr_dev(svg, "viewBox", "-5 -5 110 110");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "stroke", "black");
    			attr_dev(svg, "stroke-width", "0.5");
    			attr_dev(svg, "class", "svelte-20vn2q");
    			add_location(svg, file, 46, 0, 986);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, rect);
    			append_dev(svg, circle);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*ballx*/ 1) {
    				attr_dev(circle, "cx", /*ballx*/ ctx[0]);
    			}

    			if (dirty & /*bally*/ 2) {
    				attr_dev(circle, "cy", /*bally*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const ballr = 4;
    const initSpeed = 1;
    const damping = 0.999;

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Game", slots, []);
    	let ballx = 50, bally = 50;
    	const startingAngle = Math.random() * 2 * Math.PI;

    	let vx = Math.cos(startingAngle) * initSpeed,
    		vy = Math.sin(startingAngle) * initSpeed;

    	function update() {
    		$$invalidate(0, ballx += vx);
    		$$invalidate(1, bally += vy);

    		if (ballx < ballr && vx < 0) {
    			vx = -vx;
    			$$invalidate(0, ballx += (ballr - ballx) * 2);
    		}

    		if (ballx > 100 - ballr && vx > 0) {
    			vx = -vx;
    			$$invalidate(0, ballx -= (ballx - 100 + ballr) * 2);
    		}

    		if (bally < ballr && vy < 0) {
    			vy = -vy;
    			$$invalidate(1, bally += (ballr - bally) * 2);
    		}

    		if (bally > 100 - ballr && vy > 0) {
    			vy = -vy;
    			$$invalidate(1, bally -= (bally - 100 + ballr) * 2);
    		}

    		if (speed() > 1) {
    			vx *= damping;
    			vy *= damping;
    		}

    		requestAnimationFrame(update);
    	}

    	requestAnimationFrame(update);

    	function push(ax, ay) {
    		vx += ax;
    		vy += ay;
    	}

    	function speed() {
    		return Math.sqrt(vx ** 2 + vy ** 2);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Game> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		ballr,
    		initSpeed,
    		damping,
    		ballx,
    		bally,
    		startingAngle,
    		vx,
    		vy,
    		update,
    		push,
    		speed
    	});

    	$$self.$inject_state = $$props => {
    		if ("ballx" in $$props) $$invalidate(0, ballx = $$props.ballx);
    		if ("bally" in $$props) $$invalidate(1, bally = $$props.bally);
    		if ("vx" in $$props) vx = $$props.vx;
    		if ("vy" in $$props) vy = $$props.vy;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [ballx, bally, push, speed];
    }

    class Game extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { push: 2, speed: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Game",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get push() {
    		return this.$$.ctx[2];
    	}

    	set push(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get speed() {
    		return this.$$.ctx[3];
    	}

    	set speed(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.29.4 */
    const file$1 = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	return child_ctx;
    }

    // (45:2) {#each Array.from(ticks) as x}
    function create_each_block_3(ctx) {
    	let li;
    	let t_value = /*x*/ ctx[13] + "";
    	let t;

    	const block = {
    		c: function create() {
    			li = element("li");
    			t = text(t_value);
    			add_location(li, file$1, 45, 3, 941);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*ticks*/ 2 && t_value !== (t_value = /*x*/ ctx[13] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(45:2) {#each Array.from(ticks) as x}",
    		ctx
    	});

    	return block;
    }

    // (54:2) {#each ticksNormalized as tick}
    function create_each_block_2(ctx) {
    	let line;
    	let line_transform_value;

    	const block = {
    		c: function create() {
    			line = svg_element("line");
    			attr_dev(line, "x1", "0");
    			attr_dev(line, "y1", "-20");
    			attr_dev(line, "x2", "0");
    			attr_dev(line, "y2", "20");
    			attr_dev(line, "stroke", "black");
    			attr_dev(line, "transform", line_transform_value = "translate(" + /*tick*/ ctx[6].progress * width + ", " + height / 2 + ") rotate(" + (20 + /*tick*/ ctx[6].rotation * 20) + ")");
    			add_location(line, file$1, 54, 3, 1171);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, line, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*ticksNormalized*/ 4 && line_transform_value !== (line_transform_value = "translate(" + /*tick*/ ctx[6].progress * width + ", " + height / 2 + ") rotate(" + (20 + /*tick*/ ctx[6].rotation * 20) + ")")) {
    				attr_dev(line, "transform", line_transform_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(line);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(54:2) {#each ticksNormalized as tick}",
    		ctx
    	});

    	return block;
    }

    // (63:2) {#each ticksNormalized as tick}
    function create_each_block_1(ctx) {
    	let line;
    	let line_transform_value;

    	const block = {
    		c: function create() {
    			line = svg_element("line");
    			attr_dev(line, "y1", "0");
    			attr_dev(line, "x1", "-10");
    			attr_dev(line, "y2", "0");
    			attr_dev(line, "x2", "10");
    			attr_dev(line, "stroke", "black");
    			attr_dev(line, "transform", line_transform_value = "translate(20, " + /*tick*/ ctx[6].progress * 200 + ") rotate(" + (20 + /*tick*/ ctx[6].rotation * 20) + ")");
    			add_location(line, file$1, 63, 3, 1497);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, line, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*ticksNormalized*/ 4 && line_transform_value !== (line_transform_value = "translate(20, " + /*tick*/ ctx[6].progress * 200 + ") rotate(" + (20 + /*tick*/ ctx[6].rotation * 20) + ")")) {
    				attr_dev(line, "transform", line_transform_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(line);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(63:2) {#each ticksNormalized as tick}",
    		ctx
    	});

    	return block;
    }

    // (79:2) {#each ticksNormalized as tick}
    function create_each_block(ctx) {
    	let g;
    	let line;
    	let text_1;
    	let t_value = String(/*tick*/ ctx[6].raw).substr(-4) + "";
    	let t;
    	let g_transform_value;

    	const block = {
    		c: function create() {
    			g = svg_element("g");
    			line = svg_element("line");
    			text_1 = svg_element("text");
    			t = text(t_value);
    			attr_dev(line, "x1", "-80");
    			attr_dev(line, "y1", "0");
    			attr_dev(line, "x2", "0");
    			attr_dev(line, "y2", "0");
    			attr_dev(line, "stroke", "black");
    			add_location(line, file$1, 80, 3, 2052);
    			attr_dev(text_1, "x", "30");
    			attr_dev(text_1, "y", "0");
    			attr_dev(text_1, "text-anchor", "end");
    			add_location(text_1, file$1, 81, 3, 2100);
    			attr_dev(g, "transform", g_transform_value = "translate(" + (20 + 80) + ", " + /*tick*/ ctx[6].progress * 400 + ") rotate(" + (/*tick*/ ctx[6].rotation * 2 - 1) * 10 * Math.max(1, /*game*/ ctx[0].speed()) + ")");
    			add_location(g, file$1, 79, 2, 1930);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, g, anchor);
    			append_dev(g, line);
    			append_dev(g, text_1);
    			append_dev(text_1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*ticksNormalized*/ 4 && t_value !== (t_value = String(/*tick*/ ctx[6].raw).substr(-4) + "")) set_data_dev(t, t_value);

    			if (dirty & /*ticksNormalized, game*/ 5 && g_transform_value !== (g_transform_value = "translate(" + (20 + 80) + ", " + /*tick*/ ctx[6].progress * 400 + ") rotate(" + (/*tick*/ ctx[6].rotation * 2 - 1) * 10 * Math.max(1, /*game*/ ctx[0].speed()) + ")")) {
    				attr_dev(g, "transform", g_transform_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(79:2) {#each ticksNormalized as tick}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let header;
    	let h1;
    	let t1;
    	let button;
    	let t3;
    	let main;
    	let div0;
    	let h20;
    	let t5;
    	let ol;
    	let t6;
    	let div1;
    	let h21;
    	let t8;
    	let svg0;
    	let line0;
    	let line0_y__value;
    	let line0_y__value_1;
    	let t9;
    	let div2;
    	let h22;
    	let t11;
    	let svg1;
    	let line1;
    	let t12;
    	let footer;
    	let div3;
    	let h23;
    	let t14;
    	let game_1;
    	let t15;
    	let div4;
    	let h24;
    	let t17;
    	let svg2;
    	let line2;
    	let line2_x__value;
    	let line2_x__value_1;
    	let svg2_width_value;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value_3 = Array.from(/*ticks*/ ctx[1]);
    	validate_each_argument(each_value_3);
    	let each_blocks_3 = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks_3[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	let each_value_2 = /*ticksNormalized*/ ctx[2];
    	validate_each_argument(each_value_2);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_2[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value_1 = /*ticksNormalized*/ ctx[2];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let game_1_props = {};
    	game_1 = new Game({ props: game_1_props, $$inline: true });
    	/*game_1_binding*/ ctx[4](game_1);
    	let each_value = /*ticksNormalized*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			header = element("header");
    			h1 = element("h1");
    			h1.textContent = "Spiking non-neural non-network!";
    			t1 = space();
    			button = element("button");
    			button.textContent = "Add One";
    			t3 = space();
    			main = element("main");
    			div0 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Ticks, tabulated";
    			t5 = space();
    			ol = element("ol");

    			for (let i = 0; i < each_blocks_3.length; i += 1) {
    				each_blocks_3[i].c();
    			}

    			t6 = space();
    			div1 = element("div");
    			h21 = element("h2");
    			h21.textContent = "Ticks, visualized";
    			t8 = space();
    			svg0 = svg_element("svg");
    			line0 = svg_element("line");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t9 = space();
    			div2 = element("div");
    			h22 = element("h2");
    			h22.textContent = "Ticks, streamlined";
    			t11 = space();
    			svg1 = svg_element("svg");
    			line1 = svg_element("line");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t12 = space();
    			footer = element("footer");
    			div3 = element("div");
    			h23 = element("h2");
    			h23.textContent = "Bouncing ball";
    			t14 = space();
    			create_component(game_1.$$.fragment);
    			t15 = space();
    			div4 = element("div");
    			h24 = element("h2");
    			h24.textContent = "Ticks, together";
    			t17 = space();
    			svg2 = svg_element("svg");
    			line2 = svg_element("line");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(h1, file$1, 36, 0, 725);
    			attr_dev(button, "tabindex", "0");
    			attr_dev(button, "class", "svelte-1r6jf9j");
    			add_location(button, file$1, 37, 0, 766);
    			attr_dev(header, "class", "svelte-1r6jf9j");
    			add_location(header, file$1, 35, 0, 716);
    			add_location(h20, file$1, 42, 1, 873);
    			attr_dev(ol, "class", "svelte-1r6jf9j");
    			add_location(ol, file$1, 43, 1, 900);
    			attr_dev(div0, "class", "column svelte-1r6jf9j");
    			add_location(div0, file$1, 41, 0, 851);
    			add_location(h21, file$1, 50, 1, 1000);
    			attr_dev(line0, "x1", "0");
    			attr_dev(line0, "y1", line0_y__value = height / 2);
    			attr_dev(line0, "x2", width);
    			attr_dev(line0, "y2", line0_y__value_1 = height / 2);
    			attr_dev(line0, "stroke", "black");
    			add_location(line0, file$1, 52, 2, 1066);
    			attr_dev(svg0, "width", width);
    			attr_dev(svg0, "height", height);
    			add_location(svg0, file$1, 51, 1, 1028);
    			attr_dev(div1, "class", "column svelte-1r6jf9j");
    			add_location(div1, file$1, 49, 0, 978);
    			add_location(h22, file$1, 59, 1, 1355);
    			attr_dev(line1, "x1", "20");
    			attr_dev(line1, "y1", "0");
    			attr_dev(line1, "x2", "20");
    			attr_dev(line1, "y2", "200");
    			attr_dev(line1, "stroke", "black");
    			add_location(line1, file$1, 61, 2, 1412);
    			attr_dev(svg1, "width", "40");
    			attr_dev(svg1, "height", "200");
    			add_location(svg1, file$1, 60, 1, 1384);
    			attr_dev(div2, "class", "column utd svelte-1r6jf9j");
    			add_location(div2, file$1, 58, 0, 1329);
    			attr_dev(main, "class", "grid svelte-1r6jf9j");
    			add_location(main, file$1, 40, 0, 831);
    			add_location(h23, file$1, 71, 1, 1698);
    			attr_dev(div3, "class", "column svelte-1r6jf9j");
    			add_location(div3, file$1, 70, 0, 1676);
    			add_location(h24, file$1, 75, 1, 1776);
    			attr_dev(line2, "x1", line2_x__value = 20 + 80);
    			attr_dev(line2, "y1", "0");
    			attr_dev(line2, "x2", line2_x__value_1 = 20 + 80);
    			attr_dev(line2, "y2", "400");
    			attr_dev(line2, "stroke", "black");
    			add_location(line2, file$1, 77, 2, 1836);
    			attr_dev(svg2, "width", svg2_width_value = 40 + 100);
    			attr_dev(svg2, "height", "400");
    			add_location(svg2, file$1, 76, 1, 1802);
    			attr_dev(div4, "class", "column svelte-1r6jf9j");
    			add_location(div4, file$1, 74, 0, 1754);
    			attr_dev(footer, "class", "grid svelte-1r6jf9j");
    			add_location(footer, file$1, 69, 0, 1654);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    			append_dev(header, t1);
    			append_dev(header, button);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			append_dev(div0, h20);
    			append_dev(div0, t5);
    			append_dev(div0, ol);

    			for (let i = 0; i < each_blocks_3.length; i += 1) {
    				each_blocks_3[i].m(ol, null);
    			}

    			append_dev(main, t6);
    			append_dev(main, div1);
    			append_dev(div1, h21);
    			append_dev(div1, t8);
    			append_dev(div1, svg0);
    			append_dev(svg0, line0);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(svg0, null);
    			}

    			append_dev(main, t9);
    			append_dev(main, div2);
    			append_dev(div2, h22);
    			append_dev(div2, t11);
    			append_dev(div2, svg1);
    			append_dev(svg1, line1);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(svg1, null);
    			}

    			insert_dev(target, t12, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, div3);
    			append_dev(div3, h23);
    			append_dev(div3, t14);
    			mount_component(game_1, div3, null);
    			append_dev(footer, t15);
    			append_dev(footer, div4);
    			append_dev(div4, h24);
    			append_dev(div4, t17);
    			append_dev(div4, svg2);
    			append_dev(svg2, line2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(svg2, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*addOne*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*Array, ticks*/ 2) {
    				each_value_3 = Array.from(/*ticks*/ ctx[1]);
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks_3[i]) {
    						each_blocks_3[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_3[i] = create_each_block_3(child_ctx);
    						each_blocks_3[i].c();
    						each_blocks_3[i].m(ol, null);
    					}
    				}

    				for (; i < each_blocks_3.length; i += 1) {
    					each_blocks_3[i].d(1);
    				}

    				each_blocks_3.length = each_value_3.length;
    			}

    			if (dirty & /*ticksNormalized, width, height*/ 4) {
    				each_value_2 = /*ticksNormalized*/ ctx[2];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_2(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(svg0, null);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_2.length;
    			}

    			if (dirty & /*ticksNormalized*/ 4) {
    				each_value_1 = /*ticksNormalized*/ ctx[2];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(svg1, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			const game_1_changes = {};
    			game_1.$set(game_1_changes);

    			if (dirty & /*ticksNormalized, Math, game, String*/ 5) {
    				each_value = /*ticksNormalized*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(svg2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(game_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(game_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks_3, detaching);
    			destroy_each(each_blocks_2, detaching);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(footer);
    			/*game_1_binding*/ ctx[4](null);
    			destroy_component(game_1);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const retention = 5000; // how long ticks are preserved
    const width = 500; // svg size
    const height = 200;

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let game;
    	let ticks = new Set();

    	function addOne() {
    		const now = Date.now();
    		ticks.add(now);
    		$$invalidate(1, ticks);

    		setTimeout(
    			() => {
    				ticks.delete(now);
    				$$invalidate(1, ticks);
    			},
    			retention + 100
    		);

    		const angle = now % 20 / 20 * Math.PI * 2;
    		game.push(Math.cos(angle), Math.sin(angle));
    	}

    	let ticksNormalized = [];

    	function update() {
    		const now = Date.now();

    		$$invalidate(2, ticksNormalized = Array.from(ticks).map(x => {
    			return {
    				raw: x,
    				progress: (now - x) / retention,
    				rotation: x % 20 / 20
    			};
    		}));

    		requestAnimationFrame(update);
    	}

    	requestAnimationFrame(update);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function game_1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			game = $$value;
    			$$invalidate(0, game);
    		});
    	}

    	$$self.$capture_state = () => ({
    		Game,
    		retention,
    		width,
    		height,
    		game,
    		ticks,
    		addOne,
    		ticksNormalized,
    		update
    	});

    	$$self.$inject_state = $$props => {
    		if ("game" in $$props) $$invalidate(0, game = $$props.game);
    		if ("ticks" in $$props) $$invalidate(1, ticks = $$props.ticks);
    		if ("ticksNormalized" in $$props) $$invalidate(2, ticksNormalized = $$props.ticksNormalized);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [game, ticks, ticksNormalized, addOne, game_1_binding];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
