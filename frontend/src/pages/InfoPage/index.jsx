import React from 'react';
import { BsTwitterX, BsYoutube } from "react-icons/bs";
import '../../styles/general.css';
import './info_page.css';
import BasePageLayout from '../../layouts/BasePageLayout';
/**
 *
 * @return {JSX.Element}
 */
function InfoPage() {
  const pageContent = (
    <div className="flex flex-col items-center justify-center m-2">
      <div className="w-full flex flex-col items-center justify-center">
        <h2 className="text-2xl">趣旨</h2>

        <p className="mt-5">
          当サイトは国会で議論されている法案について、
          各党がどのような投票をしているか、どのような討論をしているかを簡単に検索できるように作成されました。
          当サイトの情報が利用者の投票に役立つことを祈ります。
        </p>
      </div>
      <div className="w-full flex flex-col items-center justify-center m-2">
        <h2 className="text-2xl">引用</h2>
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
			<tr>
				<td>過去の衆議院議員リスト</td>
				<td>
					<a href=" https://kokkai.sugawarataku.net/giin/rgiin.html">
					国会議員白書
					</a>
				</td>
			</tr>
			<tr>
				<td>参議院議員リスト</td>
				<td>
					<a href="https://www.sangiin.go.jp/japanese/san60/giin/index.html">
					参議院ホームページ
					</a>
				</td>
			</tr>
			<tr>
				<td>衆議院議員リスト</td>
				<td>
					<a href="https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/011kaiha.htm">
					衆議院ホームページ
					</a>
				</td>
			</tr>
			<tr>
				<td>選挙区ポリゴンデータ</td>
				<td>
					<a href="https://gtfs-gis.jp/senkyoku/">
					衆議院議員選挙の小選挙区の統計データ及び地図データ
					</a>
				</td>
			</tr>
			<tr>
				<td>発言分析の元論文</td>
				<td>
					<a href="https://arxiv.org/pdf/2505.07118">
					KOKKAI DOC: An LLM-driven framework for scaling parliamentary representatives
					</a>
				</td>
			</tr>
          </tbody>
        </table>
      </div>
      <div className="w-full flex flex-col items-center justify-center m-2">
        <h2 className="text-2xl">免責事項</h2>
        <p className="mt-5">
          当サイト管理者は利用者が当サイトにて公開されている情報を用いて行う一切の行為について責任を負いません。
          当サイトの利用は各利用者の自己責任にて行っていただけます。
        </p>
      </div>
      <div className="w-full flex flex-col items-center justify-center m-2">
        <h2 className="text-2xl">著作権</h2>
        <p className="mt-5">
          当サイトにて公開されている内容に関して、編集著作権を含む権利は当サイト管理者に帰属します。
          よって、当サイトの内容を管理者の承諾を得ずに使用することは禁止します。
        </p>
      </div>
      <div className="w-full flex flex-col items-center justify-center m-2">
        <h2 className="text-2xl">お問い合わせ</h2>
        <p className="mt-2">kokkai.doc[アット]gmail.com</p>
        <a href="https://x.com/kokkaidoc" className="flex mt-2 items-center">
          <BsTwitterX className="text-xl mr-1" />
          <p>@kokkaidoc</p>
        </a>
		<a href="https://www.youtube.com/@kokkaidoc_no_naka" className="flex mt-2 items-center">
          <BsYoutube className="text-xl mr-1" />
          <p>@kokkaidoc_no_naka</p>
        </a>
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
