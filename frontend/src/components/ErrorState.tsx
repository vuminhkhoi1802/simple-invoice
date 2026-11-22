interface Props {
  title?: string;
  messages: string[];
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', messages, onRetry }: Props) {
  return (
    <div className="error-state" role="alert">
      <h2>{title}</h2>
      {messages.map((m) => (
        <p key={m}>{m}</p>
      ))}
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
