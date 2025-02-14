#!/bin/bash

# Do fixed-string rewrites across the Gwern.net source corpus, inclusive of both code & generated snippets & YAML & Markdown.
# Needs to handle a number of special cases like affiliation anchors.

if [ $# -eq 4 ]; then
    # special-case https://validator.w3.org output of the form
    # "http://haskell.org/haskellwiki/Xmonad/Config_archive/Gwern's_xmonad.hs redirected to https://wiki.haskell.org/Xmonad/Config_archive/Gwern's_xmonad.hs"
    gwsed "$1" "$4"
else
    if [ $# -eq 2 ] && [ "$1" != "$2" ]; then
        LENGTH1=$(echo -e "$1" | wc --lines)
        LENGTH2=$(echo -e "$2" | wc --lines)
        if [ $LENGTH1 != "1" ] || [ $LENGTH2 != "1" ]; then
            echo "Either $1 or $2 appears to be multiple lines, which is probably a mistake, so not rewriting."
            exit 2;
        fi
        if [ "$1" == 'http://https://' ] && [ "$2" == 'https://' ]; then
            echo "Unsafe rewrite specified, erroring out."
            exit 3
        fi

        # special-case: if the transformation is merely 'http://' → 'https://' (most common rewrite I do), we call out to `gwhttp` (defined in /static/build/bash.sh because it's simple) instead
        # which will rewrite all links of that domain, not just this one instance. This can save a lot of time over doing rewrites one-by-one as they are noticed.
        HTTPS2=${1//http:/https:}
        HTTP="http://$(echo "$1" | sed -e 's/[^/]*\/\/\([^@]*@\)\?\([^:/]*\).*/\2/')"
        if [[ "$1" =~ http://.* && "$2" =~ https://.* && "$2" == "$HTTPS2" && ! "$1" == "$HTTP" ]]; then
            gwhttp "$1"
        else
            # proceed with trying to do a normal sitewide replacement:
            FILES=$((find ~/wiki/ -name "*.page"; find ~/wiki/metadata/ ~/wiki/haskell/ ~/wiki/static/ \
                                                       -name "*.yaml" -or -name "*.hs" -or -name "*.html"; ) | \
                        grep -F -v -e '.#' -e 'backlink/' -e '_site/' -e 'static/includes/' -e 'static/build/Utils.hs' -e 'static/build/Config/LinkArchive.hs' | \
                        xargs grep -F --files-with-matches "$1" | sort)
            if [ -z "$FILES" ]; then
                echo "No matches; exiting while doing nothing." 1>&2
            else
                echo "Replacing in: $FILES"
                # /static/build/stringReplace.hs is a simple Haskell script which does brute string replacement: the first string turns into the second, *period*. No regexp no interpretation no escaping no nothing! It also is compiled & parallelized for a nice speedup.
                echo "$FILES" | stringReplace "$1" "$2";
                stringReplace "$1" "$2" ~/wiki/metadata/archive.hs # for some reason, archive.hs doesn't seem to update properly with just one gwsed call; I'm not sure why.
                gw () { ( find ~/wiki/ -type f -name "*.page"
                          find ~/wiki/metadata/ ~/wiki/haskell/ -name "*.hs" -or -name "*.yaml"
                          find ~/wiki/static/ -type f -name "*.js" -or -name "*.css" -or -name "*.hs" -or -name "*.conf" -or -name "*.yaml"
                          find ~/wiki/ -type f -name "*.html" -not -wholename "*/doc/*" ) | \
                            grep -F -v -e '.#' -e 'auto.hs' -e 'static/build/LinkMetadata.hs' -e 'static/build/Config/LinkArchive.hs' -e 'static/js/tablesorter.js' -e metadata/annotation/ -e '.#' -e '_site/' | \
                            sort --unique  | xargs grep -F --ignore-case --color=always --with-filename "$@" | cut -c 1-2548; }
                gw "$1";

                # special-case cleanup: if adding an affiliation, we need to clean up inconsistent doubled
                # gwsed /doc/foo.pdf /doc/foo.pdf#deepmind && gwsed "#deepmind#deepmind" "#deepmind"
                if [[ "$2" =~ "$1"\#.+ ]];
                then SUFFIX=$(echo "$2" | sed -e 's/.*#//g'); echo $SUFFIX;
                     gwsed "#$SUFFIX#$SUFFIX" "#$SUFFIX"; gwsed "#$SUFFIX#$SUFFIX" "#$SUFFIX";
                fi
                # Special case cleanup: Remove any doubled trailing slashes
                if [[ "$2" =~ ^http.*/$ ]]; then
                    DOUBLES=$(echo "$2" | sed 's/\/\/$/\//')
                    if [[ "$2" != "$DOUBLES" ]]; then gwsed "$2" "$DOUBLES"; fi
                fi

            fi
        fi
    else
        echo "Wrong number of unique arguments: $@" 1>&2
        exit 2
    fi
fi
