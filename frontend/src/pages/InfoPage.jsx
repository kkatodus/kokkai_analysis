import "../styles/general.css"
import "../styles/pages/info_page.css"
function InfoPage() {
    return ( 
        <div className="full-page-container">
            <div className="header-section">
                <h1>このサイトについて</h1>
            </div>
            <div className='content-section info-content-section'>
                <h2 className="info-subtitle">趣旨</h2>
                <p>当サイトは国会で議論されている法案について、各党がどのような投票をしているか、どのような討論をしているかを簡単に検索できるように作成されました。当サイトの情報が利用者の投票に役立つことを祈ります。</p>
                <h2 className="info-subtitle">引用</h2>
                <p></p>
                <h2 className="info-subtitle">免責事項</h2>
                <p>当サイト管理者は利用者が当サイトにて公開されている情報を用いて行う一切の行為について責任を負いません。当サイトの利用は各利用者の自己責任にて行っていただけます。</p>
                <h2 className="info-subtitle">著作権</h2>
                <p></p>

            </div>
        </div>
     );
}

export default InfoPage;