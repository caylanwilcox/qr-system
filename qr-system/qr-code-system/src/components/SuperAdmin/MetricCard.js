// MetricCard.js
const MetricCard = ({ 
    title, 
    value, 
    variant = 'default', 
    size = 'normal',
    onClick,
    className = ''
  }) => (
    <div
      className={`metric-box ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <h3>{title}</h3>
      <div className="metric-content">
        <p className={`metric-number ${variant} ${size}`}>
          {value}
        </p>
      </div>
    </div>
  );
  
  // RankingMetrics.js
  const RankingMetrics = ({ metrics }) => (
    <div className="metric-box">
      <h3>TOTAL DE PADRINOS POR RANKING</h3>
      <div className="metric-content flex-col">
        <p className="text-blue-400">Blue: {metrics.padrinosBlue}</p>
        <p className="text-green-400">Green: {metrics.padrinosGreen}</p>
        <p className="text-red-400">Red: {metrics.padrinosRed}</p>
        <p className="text-orange-400">Orange: {metrics.padrinosOrange}</p>
      </div>
    </div>
  );
  
  export { MetricCard, RankingMetrics };