import getStats from "@/app/stats/stats";
import TotalStats from "@/app/stats/total_stats";
import { PieChart } from "@/app/stats/chart";
import Table from "@/app/table";
import { InformationCircleIcon } from "@heroicons/react/24/solid";
import byteSize from "byte-size";
import ChartScroll from "@/app/stats/chart-scroll";
import ShowSQL from "@/app/stats/sql";
import extrapolate from "@/app/stats/shitpost-model";
import ShitpostChart from "@/app/stats/shitpost-chart";
import { cumulative_sum } from "@/app/stats/utils";
import getLanguageStats, { getTotalLanguageStats } from "@/app/stats/language-stats";

function InfoBubble({ text }: { text: string }) {
  return (
    <div className="alert text-sm mb-2 p-3">
      <InformationCircleIcon width={24} />
      <span>{text}</span>
    </div>
  );
}

export default async function Page() {
  const data = await getStats();
  const new_projects_over_time = data.new_projects_over_time.sort((a, b) => (a.month < b.month ? -1 : 1));
  const new_project_versions_over_time = data.new_project_versions_over_time.sort((a, b) =>
    a.month < b.month ? -1 : 1,
  );
  const new_releases_over_time = data.new_releases_over_time.sort((a, b) => (a.month < b.month ? -1 : 1));
  const chartData = data.stats_over_time.sort((a, b) => (a.month < b.month ? -1 : 1));

  const combined_over_time_stats = new_projects_over_time.map((el, i) => ({
    month: el.month,
    new_projects: el.count,
    new_project_versions: new_project_versions_over_time[i].count,
    new_releases: new_releases_over_time[i].count,
    total_files: chartData[i].total_files,
    total_lines: chartData[i].total_lines,
    total_size: chartData[i].total_size,
  }));
  console.log("This months stats:", combined_over_time_stats[combined_over_time_stats.length - 1]);

  const projectStats = data.project_level_breakdowns.sort((a, b) => (a.month < b.month ? -1 : 1));

  const secretTypesResponse = await fetch(
    "https://raw.githubusercontent.com/pypi-data/data/main/stats/github_secret_totals.json",
  );
  const secretTypes: Map<string, number> = await secretTypesResponse.json();
  const secretTypesTable = Object.entries(secretTypes)
    .sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .map(([type, count]) => ({
      type,
      count,
    }));

  const lastMonth = chartData[chartData.length - 1];

  const binarySizes = data.binary_sizes.map((el) => {
    const is_binary = el.is_binary ? "Binary" : "Text";
    const text = `${is_binary}: ${byteSize(el.total_size, { precision: 1, units: "iec" })}`;
    return {
      ...el,
      text,
    };
  });

  const tensorflow_total_size = data.projects_by_files
    .filter((el) => el.project_name.startsWith("tf-") || el.project_name.startsWith("tensorflow-"))
    .reduce((acc, el) => acc + el.total_size, 0);
  const total_size = binarySizes.reduce((acc, el) => acc + el.total_size, 0);
  const tensorflow_percentage = Math.round((tensorflow_total_size / total_size) * 100);
  const tensorflow_human_size = byteSize(tensorflow_total_size, { precision: 1, units: "iec" });

  const skip_reason_stats = data.skip_reason_stats.filter(({ skip_reason }) => skip_reason != "");

  const years = 8;
  const extrapolated = extrapolate(years, combined_over_time_stats);
  // const extrapolated_cumulative_slice = cumulative_sum(extrapolated, ["new_releases"]);
  const in_future_years = cumulative_sum(extrapolated, ["new_releases"])[extrapolated.length - 2];

  const languageStats = await getLanguageStats();
  const languageStatsByMonth = languageStats.sort((a, b) => (a.month < b.month ? -1 : 1));

  const totalLanguageStats = await getTotalLanguageStats();
  let totalLanguageCount = totalLanguageStats.total;

  return (
    <>
      <h1 className={"text-center text-4xl lg:text-6xl"}>The contents of PyPI, in numbers</h1>
      <div className="text-center">
        <TotalStats stats={data.total_stats[0]} lastMonth={lastMonth} />
      </div>
      <div className="divider"></div>
      <p className={"text-center"}>
        This page contains a breakdown of the contents of PyPI from parsing the contents of packages. You can{" "}
        <a className={"underline text-blue-600 hover:text-blue-800 visited:text-purple-600"} href={"/download"}>
          download PyPI locally
        </a>{" "}
        to do your own analysis or run{" "}
        <a className={"underline text-blue-600 hover:text-blue-800 visited:text-purple-600"} href={"/datasets"}>
          SQL queries on the data in your browser
        </a>
      </p>
      <div className="divider"></div>
      <h1 className={"text-center"}>Language Features</h1>
      <h4 className={"text-center"}>
        This data only counts unique <strong>projects</strong>, not versions. e.g if a project has published 10 versions
        in a month, each containing an async function, it will only be counted once.
      </h4>
      <div className="grid grid-cols-1 lg:grid-cols-3">
        <div className={"lg:col-span-2"}>
          <ChartScroll
            chartData={languageStatsByMonth}
            charts={[
              {
                name: "Mature Features",
                valueNames: ["total", "has_async", "has_fstring", "has_annotations", "has_dataclasses"],
              },
              {
                name: "New Features",
                valueNames: ["total", "has_try_star", "has_match", "has_walrus"],
              },
              {
                name: "Comprehensions",
                valueNames: [
                  "total",
                  "has_async_comp",
                  "has_list_comp",
                  "has_dict_comp",
                  "has_set_comp",
                  "has_generator_expression",
                ],
              },
            ]}
          />
        </div>
        <div>
          <h3 className={"mt-3 text-center"}>Breakdown</h3>
          <Table
            addFooter={false}
            data={Object.entries(totalLanguageStats)
              .filter(([key, _]) => key != "total")
              .map(([key, value]) => {
                const percent = Math.round((value / totalLanguageCount) * 100);
                return {
                  Name: key.replace("has_", "").replace("_", " "),
                  Projects: value,
                  Percent: percent,
                };
              })
              .sort((a, b) => (a.Projects < b.Projects ? 1 : -1))}
            columns={[{ name: "Name" }, { name: "Projects", type: "number" }, { name: "Percent", type: "number" }]}
          />
        </div>
      </div>

      <div className="divider"></div>
      <h1 className={"text-center"}>Project Contents</h1>
      <h4 className={"text-center"}>
        This data only counts unique <strong>projects</strong>, not versions. e.g if a project has published 10 versions
        in a month, each with a setup.py file, it will only be counted once.
      </h4>
      <ChartScroll
        chartData={projectStats}
        sqlData={data.sql.project_level_breakdowns}
        charts={[
          {
            name: "Setup.py vs PyProject.toml",
            valueNames: ["total_project_uploads", "has_setup_py", "has_pyproject", "has_requirements_txt"],
          },
          { name: "Markdown vs RST", valueNames: ["total_project_uploads", "has_markdown", "has_rst"] },
          {
            name: "Other Files",
            valueNames: ["has_json", "has_ini", "has_xml", "has_toml", "has_yaml", "has_rust", "has_c_or_cpp"],
          },
          { name: "Typing?", valueNames: ["has_pyi", "has_py_typed"] },
          //{name: "Test Runner", valueNames: ["has_tests", "has_pytest", "has_tox"]},
        ]}
      />
      <div className="divider"></div>
      <h1 className={"text-center"}>Secrets Detected</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={"lg:col-span-2 text-center"}>
          PyPI contains a lot of secrets.
          <PieChart chartData={secretTypesTable} dataKey="count" nameKey="type" limit={10} />
        </div>
        <div>
          <Table data={secretTypesTable} columns={[{ name: "type" }, { name: "count", type: "number" }]} />
        </div>
      </div>
      <div className="divider"></div>
      <h1 className={"text-center"}>Growth</h1>

      {/*<div className="grid grid-cols-2 gap-4">*/}
      {/*  <div>*/}
      <ShitpostChart
        chartData={combined_over_time_stats}
        extrapolated={extrapolated}
        years={years}
        future_value={in_future_years.new_releases}
      />
      {/*<ShowSQL sqlData={data.sql.stats_over_time}/>*/}
      {/*</div>*/}
      {/*</div>*/}
      <div className="divider"></div>
      <h1 className={"text-center"}>Binary files</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={"lg:col-span-2"}>
          <p className={"text-center"}>
            This shows a breakdown of the binary files on PyPI, by extension. Binary files are the vast majority of the
            content on PyPI, accounting for nearly 75% of the uncompressed size.
          </p>
          <PieChart chartData={binarySizes} dataKey="total_size" nameKey="text" />
          <ShowSQL sqlData={data.sql.binary_sizes} />
        </div>
        <div>
          <Table
            data={data.binary_extension_stats}
            columns={[
              { name: "extension" },
              { name: "total_files", type: "number" },
              { name: "total_size", type: "bytes" },
              { name: "unique_files", type: "number" },
            ]}
          />
          <ShowSQL sqlData={data.sql.binary_extension_stats} />
        </div>
      </div>
      <div className="divider"></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h1 className={"text-center"}>Largest Projects by size</h1>
          <InfoBubble
            text={`Tensorflow dominates this list with ${tensorflow_human_size} of uncompressed data, ${tensorflow_percentage}% of all data on PyPI.`}
          />
          <Table
            data={data.projects_by_files}
            columns={[
              { name: "project_name" },
              { name: "unique_files", type: "number" },
              { name: "total_files", type: "number" },
              { name: "total_lines", type: "number" },
              { name: "total_size", type: "bytes" },
            ]}
          />
          <ShowSQL sqlData={data.sql.projects_by_files} />
        </div>
        <div>
          <h1 className={"text-center"}>Stats By Extensions</h1>
          <InfoBubble text={`This only considers the last suffix of the file path as the extension`} />
          <Table
            data={data.extension_stats}
            columns={[
              { name: "extension" },
              { name: "total_files", type: "number" },
              { name: "total_lines", type: "number" },
              { name: "total_size", type: "bytes" },
              { name: "unique_files", type: "number" },
            ]}
          />
          <ShowSQL sqlData={data.sql.extension_stats} />
        </div>
      </div>
      <span className={"hidden md:block"}>
        <div className="divider"></div>
        <h1 className={"text-center"}>Files not committed to Github</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={"text-center"}>
            Not all files can be committed to GitHub due to size limits. Some have a few very, very long lines whilst
            others are junk like mistakenly added virtualenvs or VCS directories. This table shows a breakdown of the
            reasons why files where skipped.
          </div>
          <div>
            <Table
              data={skip_reason_stats}
              columns={[
                { name: "skip_reason" },
                { name: "count", type: "number" },
                { name: "unique_files", type: "number" },

                { name: "max_size", type: "bytes" },
                { name: "max_lines", type: "number" },
                { name: "total_size", type: "bytes" },
                { name: "total_lines", type: "number" },

                { name: "total_projects", type: "number" },
              ]}
            />
          </div>
        </div>
      </span>
    </>
  );
}
