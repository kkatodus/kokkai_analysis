import React from "react";
import { RiFileListLine } from "react-icons/ri";
import { MdGroups2 } from "react-icons/md";
import { ImTree } from "react-icons/im";
import BaseMenuLayout from "../layouts/BaseMenuLayout";

const SangiinMenuIcons = [
  {
    link: "/sangiin_meetings",
    icon: <RiFileListLine className="menu-icon" />,
    title: "投票記録",
  },
  {
    link: "/sangiin_repr",
    icon: <MdGroups2 className="menu-icon" />,
    title: "議員一覧",
  },
  {
    link: "/sangiin_committee",
    icon: <ImTree className="menu-icon" />,
    title: "委員会一覧",
  },
];

export default function SangiinMenuPage() {
  return (
    <BaseMenuLayout backTo="/" MenuTitle="参議院" Links={SangiinMenuIcons} />
  );
}
