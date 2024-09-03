import { EditorState, Plugin } from "prosemirror-state";
import { EditorView, Decoration, DecorationSet } from "prosemirror-view";
import { Schema, Node, Fragment, DOMParser } from "prosemirror-model";
import { schema as base_schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import {
  collab,
  sendableSteps,
  receiveTransaction,
  getVersion,
} from "prosemirror-collab";
import { exampleSetup } from "./basic_setup/index";
import { lorem } from "./lorem";

// Mix the nodes from prosemirror-schema-list into the basic schema to
// create a schema with list support.
const schema = new Schema({
  nodes: addListNodes(base_schema.spec.nodes, "paragraph block*", "block"),
  marks: base_schema.spec.marks,
});

const META_TOP_LEVEL_DEC = "meta_top_level_dec";
const META_EPHEMERAL = "meta_ephemeral";

class Authority {
  constructor(doc) {
    this.doc = doc;
    this.steps = [];
    this.stepClientIDs = [];
    this.onNewSteps = [];
  }

  receiveSteps(version, steps, clientID) {
    if (version != this.steps.length) return;

    // Apply and accumulate new steps
    steps.forEach((step) => {
      this.doc = step.apply(this.doc).doc;
      this.steps.push(step);
      this.stepClientIDs.push(clientID);
    });
    // Signal listeners
    this.onNewSteps.forEach(function (f) {
      f();
    });
  }

  stepsSince(version) {
    return {
      steps: this.steps.slice(version),
      clientIDs: this.stepClientIDs.slice(version),
    };
  }
}
const authority = new Authority(
  DOMParser.fromSchema(schema).parse(document.querySelector("#content"))
);

// Get the first stylesheet in the document
const sheet = document.styleSheets[0];
// Insert a new rule into the stylesheet
sheet.insertRule(
  ".top_level_dec::before { content: attr(data-top_level_dec_count); color: red; }",
  sheet.cssRules.length
);

function is_dom_in_viewport(el) {
  const rect = el.getBoundingClientRect();
  if (rect.bottom < 0) return -1;
  if (rect.top > (window.innerHeight || document.documentElement.clientHeight))
    return 1;
  return 0;
}

function binary_search(
  arr,
  // 0 is match, negative means search right of element, positive means search left of element
  predicate: (val, idx: number) => { success: boolean; cmp: number }
) {
  let left = 0;
  let right = arr.length - 1;
  let mid = -1;
  while (left <= right) {
    // We only set mid if it isn't already set. This is key to how we handle
    // cases where the predicate does not find a match and can give us no
    // comparison values.
    if (mid === -1) mid = Math.floor((left + right) / 2);
    let result = predicate(arr[mid], mid);
    if (result.success) {
      // If the predicate is true for the mid element, return the index
      return mid;
    } else if (result.cmp < 0) {
      // If predicate condition is not satisfied, search in the right half
      left = mid + 1;
      mid = -1;
    } else if (result.cmp > 0) {
      // Search in the left half
      right = mid - 1;
      mid = -1;
    } else if (left === right) {
      return -1;
    } else if (mid === right) {
      // We bring right in to where mid should have started
      right = Math.floor((left + right) / 2);
      mid = -1;
    } else {
      // There was not a match but we also get no comparison information on
      // where to search. So we just move to the right.
      mid += 1;
    }
  }
  // Return -1 if the element is not found
  return -1;
}

function get_virtual_list_window(view, doc: Node, mapping, buffer = 20) {
  let frag = doc.content;
  let data: { node: Node; offset: number; idx: number }[] = [];
  frag.forEach((node, offset, idx) => {
    data.push({ node, offset, idx });
  });
  console.log("FRAG", data, mapping);
  function pred(datum: { node: Node; offset: number; idx: number }, i) {
    let { node, offset, idx } = datum;
    let dom = view.nodeDOM(mapping.map(offset));
    let res = { success: false, cmp: 0 };
    if (dom) {
      console.log(dom, datum);
      let cmp = is_dom_in_viewport(dom);
      if (cmp === 0) res.success = true;
      else res.cmp = cmp;
    }
    console.log("dom", dom, datum, offset, res);
    return res;
  }
  let in_window = binary_search(data, pred);
  let res = { start: 0, end: 0, data };
  if (in_window > -1) {
    res = {
      start: Math.max(0, in_window - buffer),
      end: Math.min(data.length, in_window + buffer),
      data,
    };
  }
  console.log("WINDOW", in_window, res);
  return res;
}

function update_top_level_node_decs(view) {
  let { state, dispatch } = view;
  let tx = state.tr;
  tx.setMeta(META_TOP_LEVEL_DEC, true);
  tx.setMeta(META_EPHEMERAL, true);
  tx.setMeta("addToHistory", false);
  dispatch(tx);
}

function setup_editor(root) {
  let top_level_node_plugin = new Plugin({
    state: {
      init(_, { doc }) {
        console.log(doc);
        let top_level_node_decs: Decoration[] = [];
        let set = DecorationSet.create(doc, top_level_node_decs);
        setTimeout(() => {
          update_top_level_node_decs(view);
        }, 0);
        return set;
      },
      apply(tr, set) {
        if (!tr.getMeta(META_TOP_LEVEL_DEC)) {
          setTimeout(() => {
            update_top_level_node_decs(view);
          }, 0);
          return set;
        }
        console.group("APPLY", tr.doc, set, tr);
        let { start, end, data } = get_virtual_list_window(
          view,
          tr.doc,
          tr.mapping.invert()
        );
        let top_level_node_decs: Decoration[] = [];
        // let new_set = set.map(tr.mapping, tr.doc);
        let new_set = DecorationSet.empty;
        for (let i = start; i < end; i++) {
          let count = i;
          let { node, offset } = data[i];
          let dec = Decoration.node(offset, offset + node.nodeSize, {
            style: "background: yellow",
            class: "top_level_dec",
            "data-top_level_dec_count": count + "",
          });
          console.log(i, offset, node, node.nodeSize);
          top_level_node_decs.push(dec);
        }
        console.groupEnd();
        return new_set.add(tr.doc, top_level_node_decs);
      },
    },
    props: {
      decorations(state) {
        return top_level_node_plugin.getState(state);
      },
    },
  });

  let root_element = document.querySelector(root);
  let editor_container = document.createElement("div");
  root_element.appendChild(editor_container);
  let editor = document.createElement("div");
  editor.className = "editor";
  let controls = document.createElement("div");
  controls.className = "controls";
  editor_container.appendChild(controls);
  editor_container.appendChild(editor);

  let view = new EditorView(editor, {
    state: EditorState.create({
      doc: authority.doc,
      plugins: [
        ...exampleSetup({
          schema: schema,
        }),
        top_level_node_plugin,
        collab({ version: authority.steps.length }),
      ],
    }),
    dispatchTransaction(transaction) {
      let newState = view.state.apply(transaction);
      view.updateState(newState);
      if (!transaction.getMeta(META_EPHEMERAL)) {
        let sendable = sendableSteps(newState);
        if (sendable)
          authority.receiveSteps(
            sendable.version,
            sendable.steps,
            sendable.clientID
          );
      }
    },
  });

  authority.onNewSteps.push(function () {
    let newData = authority.stepsSince(getVersion(view.state));
    view.dispatch(
      receiveTransaction(view.state, newData.steps, newData.clientIDs)
    );
  });

  create_lorem_button(view, controls, 1);
  create_lorem_button(view, controls, 5);
  create_lorem_button(view, controls, 10);
  create_lorem_button(view, controls, 50);
  create_lorem_button(view, controls, 1000);
  create_lorem_button(view, controls, 10000);

  return view;
}

function insert_node(view, node, from, to?) {
  if (to === undefined) to = from;
  const { state, dispatch } = view;
  // Create a transaction to replace the current selection with the new node
  let transaction = state.tr.replaceWith(from, to, node);
  // Dispatch the transaction to update the editor state
  dispatch(transaction);
}

function insert_node_at_selection(view, node) {
  const { state } = view;
  const { selection } = state;
  const { from, to } = selection;
  insert_node(view, node, from, to);
}

function insert_node_at_end(view, node) {
  const { state } = view;
  let end = state.doc.content.size;
  insert_node(view, node, end, end);
}

function insert_text(view, text, from, to?) {
  if (to === undefined) to = from;
  const { state, dispatch } = view;
  // Create a transaction to insert text at the current selection
  const transaction = state.tr.insertText(text, from, to);
  // Dispatch the transaction to update the editor state
  dispatch(transaction);
}

function insert_text_at_selection(view, text) {
  const { state } = view;
  const { selection } = state;
  const { from, to } = selection;
  insert_text(view, text, from, to);
}

function insert_text_at_end(view, text) {
  const { state } = view;
  let end = state.doc.content.size;
  insert_text(view, text, end, end);
}

function text_to_paragraph_nodes(text: string) {
  let para_strings = text.split(/\n{2,}/);
  let paras = para_strings.map((p) =>
    schema.nodes.paragraph.create(null, schema.text(text))
  );
  return paras;
}

function insert_lorem_ipsum(view, n: number) {
  let paras = lorem(n).flatMap((text) => text_to_paragraph_nodes(text));
  if (view.hasFocus()) insert_node_at_selection(view, Fragment.from(paras));
  else insert_node_at_end(view, Fragment.from(paras));
}

function create_lorem_button(view, controls_container, n: number) {
  let lorem_button = document.createElement("button");
  lorem_button.innerHTML = "Lorem " + n;
  lorem_button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    insert_lorem_ipsum(view, n);
  });
  controls_container?.appendChild(lorem_button);
}

let views = [setup_editor("#root"), setup_editor("#root")];

window.addEventListener("scroll", (e) => {
  views.forEach(update_top_level_node_decs);
});

/* setup page controls */
{
  let page_controls = document.getElementById("page_controls");
  let add_editor_button = document.createElement("button");
  add_editor_button.innerHTML = "Add Editor";
  add_editor_button.addEventListener("click", (e) => {
    views.push(setup_editor("#root"));
  });
  page_controls?.appendChild(add_editor_button);
}
