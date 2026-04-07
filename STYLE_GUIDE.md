# XPress Scan - UI Style Guide

This document defines the consistent styling patterns used throughout the application.

## Color Palette

### Primary Colors
- **Primary Purple**: `#2a276e` - Main brand color for buttons, headers, accents
- **Primary Purple Hover**: `#1a1548` - Hover state for primary buttons
- **Success Green**: `#00ba7c` - Success states, invoice buttons
- **Success Green Hover**: `#009e6a` - Hover state for success buttons

### Neutral Colors
- **Text Primary**: `text-gray-900` - Main text color
- **Text Secondary**: `text-gray-500` - Secondary text, descriptions
- **Border**: `border-gray-200` - Standard borders
- **Background**: `bg-gray-50` - Light backgrounds, table headers

## Typography

### Headers
```jsx
// Page/Section Headers
<h3 className="text-lg font-bold text-gray-900">Section Title</h3>

// With Icon
<h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
  <Icon size={20} className="text-[#2a276e]" />
  Section Title
</h3>

// Descriptions
<p className="text-sm text-gray-500 mt-0.5">Description text</p>
```

### Table Headers
```jsx
<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Column Name
</th>
```

### Table Cells
```jsx
// Primary cell (bold)
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
  Primary Data
</td>

// Secondary cell
<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
  Secondary Data
</td>
```

## Buttons

### Primary Button
```jsx
<button className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm">
  Button Text
</button>
```

### Success Button
```jsx
<button className="bg-[#00ba7c] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#009e6a] transition-colors shadow-sm">
  Success Action
</button>
```

### Secondary Button
```jsx
<button className="bg-gray-50 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">
  Secondary Action
</button>
```

## Tables

### Standard Table Structure
```jsx
<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
  <div className="p-6 border-b border-gray-200 flex items-center justify-between">
    <div>
      <h3 className="text-lg font-bold text-gray-900">Table Title</h3>
      <p className="text-sm text-gray-500 mt-0.5">Description</p>
    </div>
    <button className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm">
      + Add New
    </button>
  </div>

  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Column
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        <tr className="hover:bg-gray-50 transition-colors">
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            Data
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

## Status Badges

### Standard Status Badge
```jsx
<span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
  Status
</span>
```

### Status Colors
- **Success**: `bg-green-100 text-green-800 border-green-200`
- **Warning**: `bg-amber-100 text-amber-800 border-amber-200`
- **Info**: `bg-blue-100 text-blue-800 border-blue-200`
- **Error**: `bg-red-100 text-red-800 border-red-200`
- **Neutral**: `bg-gray-100 text-gray-700 border-gray-200`

## Form Inputs

### Text Input
```jsx
<input 
  type="text"
  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm transition-all"
  placeholder="Enter text"
/>
```

### Textarea
```jsx
<textarea 
  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm resize-none transition-all"
  rows={4}
  placeholder="Enter notes"
/>
```

### Select Dropdown
```jsx
<select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm transition-all">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

## Empty States

```jsx
<div className="p-8 text-center bg-gray-50">
  <p className="text-sm text-gray-500">No items found</p>
</div>
```

## Cards

### Standard Card
```jsx
<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
  {/* Card content */}
</div>
```

### Hover Card
```jsx
<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-[#2a276e]/30 transition-all cursor-pointer">
  {/* Card content */}
</div>
```

## Spacing

- **Section Spacing**: `space-y-8` or `space-y-12`
- **Grid Gap**: `gap-6` or `gap-8`
- **Padding**: `p-6` for cards, `px-6 py-4` for table cells
- **Margin**: `mb-6` for section headers

## Border Radius

- **Small**: `rounded-lg` (8px) - Buttons, inputs
- **Medium**: `rounded-xl` (12px) - Cards, tables
- **Large**: `rounded-2xl` (16px) - Large containers
- **Full**: `rounded-full` - Pills, avatars

## Shadows

- **Small**: `shadow-sm` - Buttons, small cards
- **Medium**: `shadow-md` - Hover states
- **Large**: `shadow-lg` - Modals, drawers
- **None**: No shadow for flat designs

## Transitions

Standard transition: `transition-colors` or `transition-all`
Duration: Default (150ms) or `duration-300` for slower animations

## Icons

- Use Lucide React icons
- Standard size: `size={18}` or `size={20}`
- Color: `className="text-[#2a276e]"` for primary icons

## DO NOT Use

❌ **Avoid These Patterns:**
- All-caps text in UI (except table headers with `uppercase`)
- `font-black` (use `font-bold` or `font-semibold`)
- Excessive tracking (`tracking-widest`)
- `rounded-3xl` for buttons (use `rounded-lg`)
- Inconsistent padding (stick to px-4 py-2 or px-6 py-3)
- Custom font sizes below `text-xs` (avoid `text-[10px]`)

## Consistency Checklist

✅ **Before Committing UI Changes:**
- [ ] Headers use `font-bold` not `font-black`
- [ ] Buttons use `rounded-lg` not `rounded-3xl`
- [ ] Table headers use standard `px-6 py-3 text-xs font-medium text-gray-500 uppercase`
- [ ] No all-caps text except table headers
- [ ] Primary buttons use `bg-[#2a276e]` with `hover:bg-[#1a1548]`
- [ ] Empty states use `text-sm text-gray-500`
- [ ] Status badges use `px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full`
