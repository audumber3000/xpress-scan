import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../utils/api', () => ({ api: { post: vi.fn(() => Promise.resolve({})), get: vi.fn() } }))

import { api } from '../../../utils/api'
import AddOnCard from './AddOnCard'
import { fallbackAddonCatalogue } from '../../../utils/addons'

// Rendered with react-dom directly: @testing-library/react is in devDependencies
// but its @testing-library/dom peer is not installed.
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let container
let root

const base = {
  key: 'own_whatsapp',
  label: 'Your own WhatsApp number',
  description: 'Patient messages from your number.',
  icon: 'whatsapp',
  availability: 'live',
  fulfilment: 'auto',
  currency: 'INR',
  monthly: 289,
  annual_total: 2774,
  annual_monthly: 231.17,
  annual_pct_off: 20,
  priced: true,
  included_by_plan: false,
  included_from_plan: 'Pro',
  state: 'not_bought',
  current_end: null,
  service_status: null,
  manage_link: '/admin/integrations/whatsapp',
}

const renderCard = (overrides = {}, props = {}) => {
  const onBuy = vi.fn()
  act(() => {
    root.render(
      <MemoryRouter>
        <AddOnCard item={{ ...base, ...overrides }} cycle="monthly" taxLabel="GST" clinicName="Smile Dental"
                   isOwner onBuy={onBuy} {...props} />
      </MemoryRouter>
    )
  })
  return onBuy
}

const text = () => container.textContent
const has = (needle) => (needle instanceof RegExp ? needle.test(text()) : text().includes(needle))
const button = (name) => [...container.querySelectorAll('button')].find((b) => name.test(b.textContent)) || null
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

afterEach(() => { act(() => root.unmount()); container.remove() })
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  api.post.mockClear()
})

describe('AddOnCard', () => {
  it('sells an add-on the clinic does not have, monthly', () => {
    const onBuy = renderCard()
    expect(has('₹289')).toBe(true)
    expect(has('/ month')).toBe(true)
    expect(has(/plus GST/)).toBe(true)
    expect(has(/included when you move to Pro/)).toBe(true)
    click(button(/Add/))
    expect(onBuy).toHaveBeenCalledWith('own_whatsapp', 'monthly')
  })

  it('prices the year on the annual toggle', () => {
    renderCard({}, { cycle: 'annual' })
    expect(has('₹2,774')).toBe(true)
    expect(has('/ year')).toBe(true)
    expect(has(/save 20%/)).toBe(true)
  })

  it('says Included, with no price to pay, when the plan covers it', () => {
    renderCard({ state: 'included', included_by_plan: true })
    expect(has('Included')).toBe(true)
    expect(has('In your plan')).toBe(true)
    expect(has('₹289')).toBe(false)
    expect(button(/Add/)).toBeNull()
  })

  it('shows a free grace period and offers to keep it', () => {
    renderCard({ state: 'grace', source: 'grace', current_end: '2026-10-14T00:00:00' })
    expect(has(/Free until/)).toBe(true)
    expect(button(/Add now/)).not.toBeNull()
  })

  it('tracks the Google profile work once bought', () => {
    renderCard({
      key: 'gbp_management', label: 'Google Business Profile management', icon: 'google_business',
      fulfilment: 'managed', state: 'active', current_end: '2026-10-14T00:00:00', service_status: 'in_progress',
      included_from_plan: null, manage_link: null,
    })
    expect(has(/Active until/)).toBe(true)
    for (const step of ['Requested', 'Access given', 'In progress', 'Done']) {
      expect(has(step)).toBe(true)
    }
    expect(button(/Renew early/)).not.toBeNull()
  })

  it('takes interest in a coming-soon add-on without selling it', () => {
    renderCard({ key: 'xray_integration', label: 'RVG and X-ray integration', icon: 'xray', state: 'coming_soon',
                 availability: 'coming_soon', monthly: 350, included_from_plan: null })
    expect(has('Coming soon')).toBe(true)
    expect(button(/^Add/)).toBeNull()
    click(button(/Notify me/))
    expect(has(/We'll let you know/)).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/feature-requests', expect.objectContaining({ title: 'Add-on: RVG and X-ray integration' }))
  })

  it('shows no price at all outside India', () => {
    renderCard({ state: 'unavailable', priced: false, monthly: null, annual_total: null, currency: null })
    expect(has(/₹|\$/)).toBe(false)
    expect(has(/Contact us/)).toBe(true)
  })

  it('lets only the owner buy', () => {
    const onBuy = renderCard({}, { isOwner: false })
    const addButton = button(/Add/)
    expect(addButton.disabled).toBe(true)
    click(addButton)
    expect(onBuy).not.toHaveBeenCalled()
  })
})

describe('fallbackAddonCatalogue', () => {
  it('never contains a dollar figure and claims nothing is owned', () => {
    const cat = fallbackAddonCatalogue()
    expect(JSON.stringify(cat)).not.toContain('USD')
    expect(cat.addons.map((a) => a.state)).not.toContain('active')
    expect(cat.addons.map((a) => a.state)).not.toContain('included')
    expect(cat.addons.find((a) => a.key === 'upi_payments').state).toBe('coming_soon')
  })
})
