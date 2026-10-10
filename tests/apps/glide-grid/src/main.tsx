import ReactDOM from "react-dom/client";
import "@glideapps/glide-data-grid/dist/index.css";
import { AddData } from "./AddData.js";
import { BeautifulWrapper, Description, KeyName, MoreInfo } from "./utils.js";

// No <React.StrictMode>: Storybook doesn't use it, and its dev double-mount leaves glide's
// useDebouncedMemo unmounted-flag stuck, so the accessibility <table> inside the canvas never renders.
ReactDOM.createRoot(document.getElementById("root")!).render(
    <div style={{ boxSizing: "border-box" }}>
        <div className="content">
            <BeautifulWrapper
                title="Add data"
                description={
                    <>
                        <Description>Data can be added by clicking on the trailing row.</Description>
                        <MoreInfo>
                            Keyboard is also supported, just navigate past the last row and press{" "}
                            <KeyName>Enter</KeyName>
                        </MoreInfo>
                    </>
                }>
                <AddData />
            </BeautifulWrapper>
        </div>
    </div>
);
