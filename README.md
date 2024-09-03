Just some simple experiments to get comfortable with [ProseMirror](https://prosemirror.net).
`src/index.ts` would be the main thing to look at. The code is somewhat commented.
There are at least comments about each major section. Read those for more detail.

We implement:

- decorations for styling ranges
- virtualizing a list of node decorations
- simple, in-process sync simulation

`vite dev` will serve this up at `http://localhost:5173/prosemirror_experiments/`