# Modal to Drawer Conversion Checklist

## ✅ Completed
1. Settings.jsx - Edit Permissions Modal → Drawer
2. Settings.jsx - Add User Modal → Drawer
3. Settings.jsx - Edit User Modal → Drawer
4. Settings.jsx - Add Treatment Type Modal → Drawer
5. Settings.jsx - Edit Treatment Type Modal → Drawer

## 🔄 In Progress - Settings.jsx
6. Add Referring Doctor Modal → Drawer
7. Edit Referring Doctor Modal → Drawer
8. WhatsApp Configuration Modal → Drawer
9. Password Management Modal → Drawer

## ⏳ Pending - Other Pages
10. Patients.jsx - Edit Patient Modal → Drawer
11. Calendar.jsx - Appointment Detail Modal → Drawer
12. Calendar.jsx - Add Appointment Form Modal → Drawer
13. Communication.jsx - Message Editor Modal → Drawer
14. VoiceReporting.jsx - (Check for modals)

## Pattern to Follow
```jsx
<div className="fixed inset-0 z-50">
  <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={closeHandler}></div>
  <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
    {/* Header */}
    <div className="flex items-center justify-between p-6 border-b border-gray-200">
      <h3 className="text-xl font-semibold text-gray-900">Title</h3>
      <button onClick={closeHandler} className="p-2 hover:bg-gray-100 rounded-full transition">
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    {/* Content */}
    <div className="flex-1 overflow-y-auto p-6">
      {/* Form content */}
    </div>
    {/* Footer */}
    <div className="p-6 border-t border-gray-200">
      <div className="flex justify-end gap-3">
        <button onClick={closeHandler} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">Cancel</button>
        <button type="submit" form="form-id" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">Submit</button>
      </div>
    </div>
  </div>
</div>
```
