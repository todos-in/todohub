export type TCursor = string
export type TPageInfo = {
  endCursor: TCursor,
  hasNextPage: boolean
}

export interface IComment {
  body: string,
  id: string,
  author: { login: string }
}


export interface ICommentsResponse {
  repository: {
    issue: {
      id: string
      comments: {
        nodes: [IComment],
        pageInfo: TPageInfo
      }
    }
  }
}

export interface IIssuesResponse {
  repository: {
    issues: {
      nodes: [
        {
          title: string,
          number: number,
          id: string,
          body: string,
          author: { login: string },
          comments: {
            totalCount: number
            edges: [{ node: IComment }],
            pageInfo: TPageInfo
          }
        }
      ],
      pageInfo: TPageInfo
    }
  }
}

