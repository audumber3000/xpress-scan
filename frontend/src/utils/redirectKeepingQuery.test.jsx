import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'

// Mirrors App.jsx's RedirectKeepingQuery: the Cashfree return lands on
// /subscription?order_id=..., and the order id must survive the redirect.
const RedirectKeepingQuery = ({ to }) => {
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: to, search, hash }} replace />
}
const Where = () => {
  const l = useLocation()
  return <span id="where">{l.pathname + l.search}</span>
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('subscription return redirect', () => {
  it('keeps order_id and tab through the redirect', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/subscription?tab=addons&order_id=ADD_2_own_whatsapp_m_x_y']}>
          <Routes>
            <Route path="/subscription" element={<RedirectKeepingQuery to="/admin/subscription" />} />
            <Route path="/admin/subscription" element={<Where />} />
          </Routes>
        </MemoryRouter>
      )
    })
    expect(el.querySelector('#where').textContent).toBe('/admin/subscription?tab=addons&order_id=ADD_2_own_whatsapp_m_x_y')
    act(() => root.unmount())
  })
})
