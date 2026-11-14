import { Link } from 'react-router-dom';

export function Brand() {
  return <Link className="brand" to="/" aria-label="Domyx ActivityDesk home"><span className="brand-mark">D</span><span>domyx<span className="brand-light">activitydesk</span></span></Link>;
}
