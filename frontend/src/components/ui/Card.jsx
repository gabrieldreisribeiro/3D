function Card({ children, className = '' }) {
  return <div className={`card-pro ${className}`.trim()}>{children}</div>;
}

export default Card;
