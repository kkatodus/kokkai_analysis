import React from "react";
import "../styles/general.css";
import "../styles/pages/info_page.css";
import BasePageLayout from "../layouts/BasePageLayout";
/**
 *
 * @return {JSX.Element}
 */
function InfoPage() {
  const pageContent = (
    <div className="content-section info-content-section">
      <div className="info-content">
        <h2 className="info-subtitle">趣旨</h2>

        <p>
          当サイトは国会で議論されている法案について、
          各党がどのような投票をしているか、どのような討論をしているかを簡単に検索できるように作成されました。
          当サイトの情報が利用者の投票に役立つことを祈ります。
        </p>
      </div>
      <div className="info-content">
        <h2 className="info-subtitle">引用</h2>
        <table>
          <tbody>
            <tr>
              <th>情報</th>
              <th>情報元</th>
            </tr>
            <tr>
              <td>投票結果（参議院）</td>
              <td>
                <a href="https://www.sangiin.go.jp/japanese/touhyoulist/touhyoulist.html">
                  参議院ホームページ
                </a>
              </td>
            </tr>
            <tr>
              <td>討論内容</td>
              <td>
                <a href="https://kokkai.ndl.go.jp/api.html">
                  国会会議録検索システム
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="info-content">
        <h2 className="info-subtitle">免責事項</h2>
        <p>
          当サイト管理者は利用者が当サイトにて公開されている情報を用いて行う一切の行為について責任を負いません。
          当サイトの利用は各利用者の自己責任にて行っていただけます。
        </p>
      </div>
      <div className="info-content">
        <h2 className="info-subtitle">著作権</h2>
        <p>
          当サイトにて公開されている内容に関して、編集著作権を含む権利は当サイト管理者に帰属します。
          よって、当サイトの内容を管理者の承諾を得ずに使用することは禁止します。
        </p>
      </div>
    </div>
  );
  return (
    <BasePageLayout
      backTo="/"
      pageTitle="このサイトについて"
      MainContent={pageContent}
    />
  );
}

export default InfoPage;
