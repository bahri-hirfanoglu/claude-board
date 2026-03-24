export default function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-claude/20 border-t-claude animate-spin" />
    </div>
  );
}
