export default function InviteLayout({ children }) {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#ffffff',
            margin: 0,
            padding: 0,
            overflow: 'auto',
            zIndex: 999999
        }}>
            {children}
        </div>
    );
}
