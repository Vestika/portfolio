import json

from pymaya.maya import Maya


def main():
    securities = Maya().get_all_securities()

    output = []
    for s in securities:
        if not (symbol := s.get("Smb")):
            continue

        output.append(
            {
                "symbol": symbol.replace(".", "-") + ".TA",
                "tase_id": s.get("Id"),
                "isin": s.get("ISIN"),
                "short_name": s.get("Name"),
            }
        )

    with open("tase_securities.json", "wt") as file:
        json.dump(output, file, indent=4)


if __name__ == "__main__":
    main()
