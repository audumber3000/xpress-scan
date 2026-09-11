/**
 * LoadingSpinner — MolarPlus-style spinner using Tailwind.
 */
export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-8 h-8 border-[3px] border-[#2a276e] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Loading...</p>
    </div>
  );
}
