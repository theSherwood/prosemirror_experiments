import { EditorState, Plugin } from "prosemirror-state";
import { EditorView, Decoration, DecorationSet } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
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
const mySchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
  marks: schema.spec.marks,
});

let view = new EditorView(document.querySelector("#editor"), {
  state: EditorState.create({
    doc: DOMParser.fromSchema(mySchema).parse(
      document.querySelector("#content")
    ),
    plugins: exampleSetup({ schema: mySchema, plugins: [specklePlugin] }),
  }),
});
window.view = view;

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
  console.log("end");
  insert_text(text, end, end);
}

function insert_lorem_ipsum(n: number) {
  let text = lorem(n).join("\n\n");
  const { state } = view;
  const { selection } = state;
  console.log(selection);
  if (view.hasFocus()) insert_text_at_selection(text);
  else insert_text_at_end(text);
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
