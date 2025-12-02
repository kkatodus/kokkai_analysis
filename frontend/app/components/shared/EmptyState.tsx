interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState({ message, className = "" }: EmptyStateProps) {
  return (
    <div className={`text-center text-xs text-gray-400 ${className}`}>
      {message}
    </div>
  );
}

