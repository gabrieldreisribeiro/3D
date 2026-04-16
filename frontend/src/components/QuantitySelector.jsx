function QuantitySelector({ value, onChange }) {
  return (
    <div className="quantity-selector">
      <button onClick={() => onChange(Math.max(1, value - 1))} aria-label="Diminuir quantidade">
        –
      </button>
      <span>{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label="Aumentar quantidade">
        +
      </button>
    </div>
  );
}

export default QuantitySelector;
