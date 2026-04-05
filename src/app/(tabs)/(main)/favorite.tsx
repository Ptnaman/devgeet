import { Redirect } from "expo-router";

export default function FavoriteScreen() {
  return <Redirect href={{ pathname: "/home", params: { tab: "favorite" } }} />;
}
