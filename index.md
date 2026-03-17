---
layout: default
title: Home
---

<h1>Blog</h1>

<ul class="post-list">
  {% for post in site.posts %}
  <li class="post-list-item">
    <span class="post-list-meta">{{ post.date | date: "%B %-d, %Y" }}</span>
    <a class="post-list-link" href="{{ post.url | relative_url }}">{{ post.title }}</a>
  </li>
  {% endfor %}
</ul>
