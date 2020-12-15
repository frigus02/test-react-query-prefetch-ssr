import React from "react";
import axios from "axios";
import {
  useQuery,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "react-query";
import { dehydrate, Hydrate } from "react-query/hydration";
import { ReactQueryDevtools } from "react-query/devtools";

const getCharacters = async () => {
  await new Promise((r) => setTimeout(r, 500));
  const { data } = await axios.get(
    "https://rickandmortyapi.com/api/character/"
  );
  return data;
};

const getCharacter = async (selectedChar) => {
  await new Promise((r) => setTimeout(r, 500));
  const { data } = await axios.get(
    `https://rickandmortyapi.com/api/character/${selectedChar}`
  );
  return data;
};

export default function CustomApp({ pageProps }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        cacheTime: typeof window === "undefined" ? -1 : 5 * 60 * 1000,
      },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Hydrate state={pageProps.dehydratedState}>
        <Example />
      </Hydrate>
    </QueryClientProvider>
  );
}

CustomApp.getInitialProps = async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        cacheTime: -1,
      },
    },
  });
  try {
    await Promise.all([
      queryClient.fetchQuery("characters", getCharacters),
      queryClient.fetchQuery(["character", 1], () => getCharacter(1)),
    ]);
    const dehydratedState = dehydrate(queryClient);

    return {
      pageProps: {
        dehydratedState,
      },
    };
  } catch (err) {
    console.log("PREFETCH ERROR", err);
    return {
      pageProps: {},
    };
  }
};

function Example() {
  const client = useQueryClient();
  const [selectedChar, setSelectedChar] = React.useState(1);

  const { data } = useQuery("characters", getCharacters, {
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });

  const { data: selectedData } = useQuery(
    ["character", selectedChar],
    () => getCharacter(selectedChar),
    {
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    }
  );

  const invalidate = () => {
    client.invalidateQueries("characters");
  };

  return (
    <div className="App">
      <p>
        When selecting a character (eg. 12) it will also prefetch the sibling
        characters, too (eg. 11 and 13). When selecting one of the siblings
        after that (eg. 13), it will be displayed immediately and also refetched
        in the background.
      </p>
      <button onClick={invalidate}>Invalidate</button>
      <h2>Characters</h2>
      <ul>
        {data?.results.map((char) => (
          <li
            key={char.id}
            onClick={() => {
              setSelectedChar(char.id);
            }}
          >
            <div
              style={
                client.getQueryData(["character", char.id])
                  ? {
                      fontWeight: "bold",
                    }
                  : {}
              }
            >
              {char.id} - {char.name}
            </div>
          </li>
        ))}
      </ul>
      <h3>Selected Character</h3>
      <p>
        {selectedData?.name} ({selectedData?.status})
      </p>
      <ReactQueryDevtools initialIsOpen />
    </div>
  );
}
