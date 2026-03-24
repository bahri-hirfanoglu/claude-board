export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="text-center py-8 text-surface-500">
      {Icon && <Icon size={24} className="mx-auto mb-2 opacity-50" />}
      <p className="text-sm">{title}</p>
      {description && <p className="text-xs mt-1">{description}</p>}
    </div>
  );
}
