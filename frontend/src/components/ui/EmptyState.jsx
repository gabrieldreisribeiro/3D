function EmptyState({ title, description, action = null }) {
  return (
    <div className="empty-state-pro">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export default EmptyState;
