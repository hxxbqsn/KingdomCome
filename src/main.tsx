import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StoreProvider } from './store';
import { AuthProvider, useAuth } from './auth';
import './styles.css';
import './medieval.css';
import './refinements.css';
import './home.css';
import './account.css';

function AccountArchive() {
  const {user,loading}=useAuth();
  if(loading)return <main className="account-loading" role="status">正在读取账户...</main>;
  return <StoreProvider key={user?.id||'local'}><App/></StoreProvider>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthProvider><AccountArchive/></AuthProvider></React.StrictMode>);
