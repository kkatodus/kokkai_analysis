import React, { useEffect, useState } from "react";
import axios from "axios";
import { sangiinEndpoint } from "../resource/resources";
import BasePageLayout from "../layouts/BasePageLayout";

export default function SangiinReprPage() {
  //  eslint-disable-next-line no-unused-vars
  const [reps, setReps] = useState([]);
  //  eslint-disable-next-line no-unused-vars
  const [period, setPeriod] = useState("");
	const [kaihas, setKaihas] = useState([]);

  useEffect(() => {
    axios({
      method: "get",
      url: sangiinEndpoint + "repr",
    }).then((res) => {
      console.log(res);
      setReps(res.data.reprs);
      setPeriod(res.data.meeting_period);
    });
  }, []);

  const reprs = reps.map((rep) => {
    const { name, yomikata, kaiha, district, period, link } = rep;
    return (
      <div key={name}>
        <h1>{name}</h1>
        <h2>{yomikata}</h2>
        <h3>{kaiha}</h3>
        <h4>{district}</h4>
        <h5>{period}</h5>
        <a href={link}>link</a>
      </div>
    );
  });
  return (
    <BasePageLayout
      backTo="/sangiin_menu"
      pageTitle="議員一覧"
      MainContent={reprs}
    />
  );
}
