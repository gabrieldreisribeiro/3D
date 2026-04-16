function PriceBlock({ price, helper = 'Preco unitario' }) {
  const safePrice = Number(price ?? 0);

  return (
    <div className="price-block">
      <strong>R$ {safePrice.toFixed(2)}</strong>
      <span>{helper}</span>
    </div>
  );
}

export default PriceBlock;
