import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
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
    plugins: exampleSetup({ schema: mySchema }),
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
