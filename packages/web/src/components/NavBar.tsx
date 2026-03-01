import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: '概览' },
  { to: '/project-groups', label: '项目组' },
  { to: '/sync', label: '同步' },
  { to: '/reviews', label: '审核' },
];

const activeStyle = { background: '#16213e', borderRadius: '4px' };

export function NavBar() {
  return (
    <nav style={{ display: 'flex', gap: '4px' }}>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            color: '#fff',
            textDecoration: 'none',
            padding: '6px 14px',
            fontSize: '14px',
            ...(isActive ? activeStyle : {}),
          })}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
