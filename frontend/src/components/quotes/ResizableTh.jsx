import { Resizable } from 'react-resizable'

/* A <th> with a drag handle on its right edge.

   Two things matter here and both are easy to get wrong:

   1. THE HANDLE MUST NOT SORT. Most of these headers are click-to-sort, and a drag ends in a
      click on the same element — without stopping propagation, every resize would also re-sort
      the grid underneath the rep's hands.
   2. `enableUserSelectHack: false`. react-draggable's default hack writes user-select:none onto
      <body> during a drag; combined with this grid's inline-edit cells it leaves text
      unselectable if a drag ends outside the window. The handle sets its own cursor, so the
      hack buys nothing.

   Columns without a stored width render with no explicit width at all, so the browser's own
   sizing still applies until the rep actually drags one. */

export default function ResizableTh({ width, onResize, children, ...rest }) {
  const th = (
    <th {...rest} style={{ ...(rest.style || {}), ...(width ? { width } : null) }}>
      {children}
    </th>
  )

  // Nothing to drag against until a width is known — react-resizable needs a number.
  if (!width) return th

  return (
    <Resizable
      width={width}
      height={0}
      axis="x"
      minConstraints={[56, 0]}
      maxConstraints={[900, 0]}
      draggableOpts={{ enableUserSelectHack: false }}
      onResize={(e, data) => onResize(data.size.width)}
      handle={(
        <span
          className="col-resize-handle"
          title="Drag to resize · double-click to fit"
          onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      )}
    >
      {th}
    </Resizable>
  )
}
