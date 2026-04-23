function Card({ children, className = '' }) {
  return <div className={`glass-card rounded-2xl p-6 transition-all duration-300 hover:shadow-md ${className}`.trim()}>{children}</div>;
}

export default Card;
