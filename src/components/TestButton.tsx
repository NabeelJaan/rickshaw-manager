import React from 'react';

export default function TestButton() {
  const handleClick = () => {
    alert('Test button is working! This confirms React and button click handlers are functioning properly.');
    console.log('Test button clicked successfully');
  };

  return (
    <div className="p-8 bg-white rounded-xl shadow-sm border border-zinc-200">
      <h2 className="text-xl font-bold text-zinc-900 mb-4">Button Test</h2>
      <p className="text-zinc-600 mb-4">Click this button to test if React button click handlers are working:</p>
      <button
        onClick={handleClick}
        className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium"
      >
        Click Me to Test
      </button>
    </div>
  );
}
