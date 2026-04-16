function RatingPill({ rating, count }) {
  return (
    <span className="rating-pill">
      <strong>{rating.toFixed(1)}</strong>
      <span>{count} avaliações</span>
    </span>
  );
}

export default RatingPill;
