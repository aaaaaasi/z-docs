"use client"

import * as React from "react"

/**
 * Horizontal page ruler — the iconic Google Docs strip above the document.
 * Purely visual: inch ticks with 1/8" subdivisions, gray margin zones that
 * match the page's 1in padding, and small triangular margin indicators.
 * Sits inside the zoom wrapper so it scales with the page, never prints.
 */
export function DocRuler({ pageWidth = 816 }: { pageWidth?: number }) {
  const PX_PER_IN = 96
  const inches = pageWidth / PX_PER_IN // 8.5 for Letter
  const margin = 1 * PX_PER_IN

  const ticks: React.ReactNode[] = []
  for (let i = 0; i * 12 <= pageWidth; i++) {
    const x = i * 12 // every 1/8"
    const fromInch = i % 8
    const isInch = fromInch === 0
    const isHalf = fromInch === 4
    const isQuarter = fromInch % 2 === 0
    const h = isInch ? 12 : isHalf ? 9 : isQuarter ? 6 : 4
    if (isInch && i > 0 && i / 8 < inches) {
      ticks.push(
        <span
          key={`t${i}`}
          className="doc-ruler-label"
          style={{ left: x - 3 }}
          aria-hidden
        >
          {i / 8}
        </span>
      )
    }
    ticks.push(
      <span
        key={`k${i}`}
        className="doc-ruler-tick"
        style={{ left: x, height: h }}
        aria-hidden
      />
    )
  }

  return (
    <div
      className="no-print doc-ruler mx-auto flex h-[26px] items-end"
      role="img"
      aria-label="Page ruler — letter size with one inch margins"
    >
      {/* left margin zone */}
      <div className="doc-ruler-margin" style={{ width: margin }} title="Left margin: 1 inch" />
      <div className="doc-ruler-track relative flex-1">
        {ticks}
        <span className="doc-ruler-edge" style={{ left: 0 }} aria-hidden />
      </div>
      {/* right margin zone */}
      <div className="doc-ruler-margin" style={{ width: margin }} title="Right margin: 1 inch" />
    </div>
  )
}
