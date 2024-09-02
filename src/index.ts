import { EditorState, Plugin } from "prosemirror-state";
import { EditorView, Decoration, DecorationSet } from "prosemirror-view";
import { Schema, Fragment, DOMParser } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { exampleSetup } from "./basic_setup/index";
import { lorem } from "./lorem";

/**
 * TODO
 * - add lorem ipsum button to add text
 * - add decorations
 * - decorate every paragraph
 * - virtualize paragraph decorations
 * - collaboration support
 */

let specklePlugin = new Plugin({
  state: {
    init(_, { doc }) {
      console.log(doc);
      let top_level_node_decs: Decoration[] = [];
      let fragment = doc.content;
      let map = new Map();
      fragment.forEach((node, offset, i) => {
        let dec = Decoration.node(offset, offset + node.nodeSize, {
          style: "background: yellow",
        });
        console.log(i, offset, node, node.nodeSize);
        top_level_node_decs.push(dec);
        map.set(node, dec);
      });
      let set = DecorationSet.create(doc, top_level_node_decs);
      return { set, map };
    },
    apply(tr, { set, map }) {
      console.log("APPLY=============", tr.doc, set);
      let top_level_node_decs: Decoration[] = [];
      let fragment = tr.doc.content;
      let new_set = set.map(tr.mapping, tr.doc);
      fragment.forEach((node, offset, i) => {
        if (!map.has(node)) {
          let dec = Decoration.node(offset, offset + node.nodeSize, {
            style: "background: yellow",
          });
          console.log(i, offset, node, node.nodeSize);
          top_level_node_decs.push(dec);
          map.set(node, dec);
        }
      });
      return { set: new_set.add(tr.doc, top_level_node_decs), map };
    },
  },
  props: {
    decorations(state) {
      return specklePlugin.getState(state).set;
    },
  },
});

// Mix the nodes from prosemirror-schema-list into the basic schema to
// create a schema with list support.
const my_schema = new Schema({
  nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
  marks: schema.spec.marks,
});

let view = new EditorView(document.querySelector("#editor"), {
  state: EditorState.create({
    doc: DOMParser.fromSchema(my_schema).parse(
      document.querySelector("#content")
    ),
    plugins: exampleSetup({ schema: my_schema, plugins: [specklePlugin] }),
  }),
});
window.view = view;

function insert_node(node, from, to?) {
  if (to === undefined) to = from;
  const { state, dispatch } = view;
  // Create a transaction to replace the current selection with the new node
  let transaction = state.tr.replaceWith(from, to, node);
  // Dispatch the transaction to update the editor state
  dispatch(transaction);
}

function insert_node_at_selection(node) {
  const { state } = view;
  const { selection } = state;
  const { from, to } = selection;
  insert_node(node, from, to);
}

function insert_node_at_end(node) {
  const { state } = view;
  let end = state.doc.content.size;
  insert_node(node, end, end);
}

function insert_text(text, from, to?) {
  if (to === undefined) to = from;
  const { state, dispatch } = view;
  // Create a transaction to insert text at the current selection
  const transaction = state.tr.insertText(text, from, to);
  // Dispatch the transaction to update the editor state
  dispatch(transaction);
}

function insert_text_at_selection(text) {
  const { state } = view;
  const { selection } = state;
  const { from, to } = selection;
  insert_text(text, from, to);
}

function insert_text_at_end(text) {
  const { state } = view;
  let end = state.doc.content.size;
  insert_text(text, end, end);
}

function text_to_paragraph_nodes(text: string) {
  let para_strings = text.split(/\n{2,}/);
  let paras = para_strings.map((p) =>
    my_schema.nodes.paragraph.create(null, my_schema.text(text))
  );
  return paras;
}

function insert_lorem_ipsum(n: number) {
  let paras = lorem(n).flatMap((text) => text_to_paragraph_nodes(text));
  if (view.hasFocus()) insert_node_at_selection(Fragment.from(paras));
  else insert_node_at_end(Fragment.from(paras));
}

function create_lorem_button(n: number) {
  let controls_div = document.querySelector("#controls");
  let lorem_button = document.createElement("button");
  lorem_button.innerHTML = "Lorem " + n;
  lorem_button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    insert_lorem_ipsum(n);
  });
  controls_div?.appendChild(lorem_button);
}

create_lorem_button(1);
create_lorem_button(5);
create_lorem_button(10);
create_lorem_button(50);
create_lorem_button(1000);
