function PriceBlock({ price, helper = 'Preco unitario', personalized = false }) {
  const safePrice = Number(price ?? 0);

  return (
    <div className="price-block">
      <strong>{personalized ? 'Personalizado' : `R$ ${safePrice.toFixed(2)}`}</strong>
      <span>{helper}</span>
    </div>
  );
}

export default PriceBlock;
