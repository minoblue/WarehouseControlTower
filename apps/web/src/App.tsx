import {
  Content,
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderName,
  SideNav,
  SideNavItems,
  SideNavLink,
  Theme,
} from '@carbon/react';
import { Logout, OperationsRecord } from '@carbon/icons-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.js';
import { DashboardPage } from './DashboardPage.js';
import { LoginPage } from './LoginPage.js';

const ProtectedLayout = (): React.ReactNode => {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Theme theme="g100">
      <Header aria-label="Warehouse Control Tower">
        <HeaderName prefix="Warehouse">Control Tower</HeaderName>
        <HeaderGlobalBar>
          <span className="header-user">{user.displayName}</span>
          <HeaderGlobalAction aria-label="Sign out" onClick={logout} tooltipAlignment="end">
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
        <SideNav aria-label="Primary navigation" expanded isPersistent>
          <SideNavItems>
            <SideNavLink href="/dashboard" renderIcon={OperationsRecord} isActive>
              Operations
            </SideNavLink>
          </SideNavItems>
        </SideNav>
      </Header>
      <Content>
        <DashboardPage />
      </Content>
    </Theme>
  );
};

export const App = (): React.ReactNode => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<ProtectedLayout />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);
